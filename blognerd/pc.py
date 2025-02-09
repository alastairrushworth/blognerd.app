'''Tools to interact with the pinecone API.'''
import pandas as pd
from pinecone import Pinecone
import numpy as np
import os
import time
import re
import backoff
import voyageai

from dotenv import load_dotenv
load_dotenv()

vo = voyageai.Client(api_key=os.environ['VOYAGE_API_KEY'])

class APICallError(Exception):
    pass

def format_string_list(text_list: list) -> list:
    '''Format a list of strings for embedding'''
    # convert to list if input is a string
    if isinstance(text_list, str):
        _text_list = [text_list]
    else:
        _text_list = text_list.copy()
    # # truncate long texts, if necessary
    # _text_list = [truncate_string_to_token_limit(x, max_tokens=8191)
    #                 for x in text_list]
    return _text_list

@backoff.on_exception(backoff.constant, Exception, max_tries=2, interval=120)
def voyage_embedding_create(input: list, **kwargs) -> list:
    '''Compute an embedding for a list of strings with exponential backoff'''
    embeds = vo.embed(
        input, 
        model="voyage-3-large",
        **kwargs
    ).embeddings
    return embeds


def text_to_embedding(text_list: list, model: str = "voyage", **kwargs) -> pd.DataFrame:
    '''Compute an embedding for a string or list of strings using the voyage API'''
    _text_list = format_string_list(text_list=text_list)
    # fetch embeddings from the appropriate model
    try:
        if model == "voyage":
            embeds = voyage_embedding_create(input=_text_list, **kwargs)
        embed_df = pd.DataFrame(list(zip(_text_list, embeds)), columns=['input', 'embedding'])
    except Exception as e:
        raise APICallError(f'Error: {e} problem getting embedding. Text: {text_list}')
    return embed_df

class PineCone:
    '''
    Wrapper class for pinecone API.
    '''
    def __init__(self, index_prefix: str = "PINECONE_V2"):
        self.index_prefix = index_prefix
        self.namespace = os.environ[self.index_prefix + '_INDEX']
        # initialize connection to pinecone (get API key at app.pinecone.io)
        pc = Pinecone(api_key=os.environ['PINECONE_API_KEY'])
        self.pc_index = pc.Index(host=os.environ[self.index_prefix + '_HOST'])
    
    def query(
            self,
            filter: dict = {},
            text=None,
            embedding_vec=None,
            to_df=False,
            neg=None,
            include_metadata=True,
            **kwargs
            ):
        '''Generic query function for pinecone'''
        if (embedding_vec is None) and (text is None):
            raise Exception('Must provide either text or embedding_vec')
        
        # get embedding of query text
        if (embedding_vec is None):
            text = [text] if not isinstance(text, list) else text
            embedding = text_to_embedding(text, model='voyage', input_type='query')
            if neg is not None:
                neg_embedding = text_to_embedding(neg, model='voyage', input_type='query')
                neg_embedding_vec = neg_embedding.embedding[0]
                embedding_vec = list(np.array(embedding_vec) - 0.5*np.array(neg_embedding_vec))
            embedding_vec = embedding.embedding[0]

        # query pinecone
        res = self.pc_index.query(
            vector=embedding_vec,
            include_metadata=include_metadata,
            filter=filter,
            **kwargs
            )
        # convert to dataframe if requested
        if to_df:
            res = pd.DataFrame(
            [{'url': x['id'], **x['metadata'], 'pcscore': x['score'], 'values': x['values']} for x in res['matches']])
        return res

type_dict = {
    'news': 'news',
    'academic': 'academic',
    'arxiv': 'academic',
    'arxiv.org': 'academic',
    'papers': 'academic',
    'journals': 'academic',
    'blog': 'blog',
    'blogs': 'blog',
}

stype_dict = {
    'blog': ['blog', 'individual / personal blog'],
    'periodic': ['periodic newsletter digest'],
    'eng': ['company engineering blog'],
    'news': ['news / media publication']
}

since_dict = {
    'yesterday': 24 * 60 * 60,
    'last_3days': 3 * 24 * 60 * 60,
    'last_week': 7 * 24 * 60 * 60,
    'last_month': 30 * 24 * 60 * 60,
    'last_3months': 3 * 30 * 24 * 60 * 60,
    'last_year': 365 * 24 * 60 * 60,
}

def search_pc(qry, nmax, stype=None):
    pc = PineCone()
    if 'type:feeds' in qry:
        qry = qry.replace('type:feeds', '')
        print('fetching feeds...')
        xx, time_taken = search_feeds(
            qry=qry,
            pc=pc,
            nmax=nmax
            )
    else:
        xx, time_taken = search_content(
            qry=qry,
            pc=pc,
            nmax=nmax,
            stype=stype
            )
    return xx, time_taken


def search_feeds(qry, pc, nmax):
    startx = time.time()
    if isinstance(qry, str):
        z = pc.query(
            namespace='blaze-feeds-v2', 
            text=qry,
            include_values=False,
            to_df=True,
            top_k=nmax, 
        )
    else:
        z = pc.query(
            namespace='blaze-feeds-v2', 
            embedding_vec=qry,
            include_values=False,
            to_df=True,
            top_k=nmax, 
        )
    # stop timers
    endx = time.time()
    time_taken = endx - startx

    # clean up results
    xx = z \
        .assign(title = lambda x: x.owner_name + ' (' + x.baseurl + ')') \
        .drop_duplicates(subset=['baseurl'], keep='first') \
        .sort_values(by='pcscore', ascending=False) \
        .assign(pcscore = lambda x: x.pcscore.round(3)) \
        .reset_index(drop=True) \
        .rename(columns={'baseurl': 'basedomain', 'rss': 'url', 'short_summary': 'subtitle'}) \
        .assign(url = lambda x: x.basedomain) \
        .assign(date = '')

    # final cleanup
    xx = xx.reset_index(drop=True)
    return xx, time_taken


def search_content(qry, pc, nmax, stype=None):
    qry_raw = qry
    # is stype is not None, add to filter
    filter = {}
    if stype is not None:
        if stype not in ['', 'everything']:
            filter.update({'rsstype': {'$eq': type_dict[stype]}})

    # parse type: from searchx
    if 'type:' in qry:
        type_arg = re.search('type:(.*?)( |$)', qry).group(0)
        stype = type_arg.replace('type:', '').strip()
        qry = qry.replace(type_arg, '').strip()
        if stype not in ['', 'everything']:
            filter.update({'rsstype': {'$eq': type_dict[stype]}})

    if 'sype:' in qry:
        type_arg = re.search('sype:(.*?)( |$)', qry).group(0)
        stype = type_arg.replace('sype:', '').strip()
        qry = qry.replace(type_arg, '').strip()
        if stype not in ['', 'everything']:
            filter.update({'site_type': {'$in': stype_dict[stype]}}) 
    
    if 'oype:' in qry:
        type_arg = re.search('oype:(.*?)( |$)', qry).group(0)
        stype = type_arg.replace('oype:', '').strip()
        qry = qry.replace(type_arg, '').strip()
        if stype not in ['', 'everything']:
            if stype == 'individual':
                filter.update({'owner_type': {'$eq': stype}}) 
            else:
                filter.update({'owner_type': {'$ne': 'individual'}})

    # parse since: from searchx
    if 'since:' in qry:
        since_arg = re.search('since:(.*?)( |$)', qry).group(0)
        since = since_arg.replace('since:', '').strip()
        qry = qry.replace(since_arg, '').strip()
        if since in since_dict.keys():
            filter.update({'unix_time': {'$gt': time.time() - since_dict[since]}})

    # parse base_url: from searchx
    if 'site:' in qry:
        base_url_arg = re.search('site:(.*?)( |$)', qry).group(0)
        base_url = base_url_arg.replace('site:', '').strip()
        qry = qry.replace(base_url_arg, '').strip()
        filter.update({'base_url': {'$eq': base_url}})

    # parse lang: from searchx
    if 'lang:' in qry:
        lang_arg = re.search('lang:(.*?)( |$)', qry).group(0)
        lang = lang_arg.replace('lang:', '').strip()
        qry = qry.replace(lang_arg, '').strip()
        filter.update({'lang': {'$eq': lang}})

    # parse score: from searchx
    if ('score:' in qry) and (stype != 'academic'):
        score_arg = re.search('score:(.*?)( |$)', qry).group(0)
        score = score_arg.replace('score:', '').strip()
        qry = qry.replace(score_arg, '').strip()
        filter.update({'score': {'$gt': float(score)}})

    # parse length: from searchx
    if 'length:' in qry:
        length_arg = re.search('length:(.*?)( |$)', qry).group(0)
        length = length_arg.replace('length:', '').strip()
        qry = qry.replace(length_arg, '').strip()
        filter.update({'length': {'$gt': float(length)}})

    # parse like: from searchx
    if 'like:' in qry:
        like_arg = re.search('like:(.*?)( |$)', qry).group(0)
        like = like_arg.replace('like:', '').strip()
        vec = pc.pc_index.fetch(ids=[like], namespace=pc.namespace)
        qry = vec['vectors'][like].values

    # parse - from searchx
    if ' <' in qry:
        # find neg args in the format between quotes '"' and '"'
        neg_arg = re.search(r"<(.*?)>", qry).group(0)
        neg = neg_arg.replace('<', '').strip()
        neg = neg.replace('>', '').strip()
        qry = qry.replace(neg_arg, '').strip()
        print('negation:', neg)
    else:
        neg = None

    # parse sort: from searchx
    sort = None
    if 'sort:' in qry:
        sort_arg = re.search('sort:(.*?)( |$)', qry).group(0)
        sort = sort_arg.replace('sort:', '').strip()
        qry = qry.replace(sort_arg, '').strip()

    if not 'like:' in qry_raw:
        print(f'query: {qry}')
    else:
        print(f'query: like:{like}')
    print(f'filter: {filter}')
    # start timers    
    startx = time.time()

    if qry == '' or qry == ['']:
        qry = 'a'
    if isinstance(qry, str):
        z = pc.query(
            namespace=pc.namespace, 
            text=qry,
            include_values=False,
            to_df=True,
            filter=filter,
            top_k=nmax, 
            neg=neg
        )
    else:
        z = pc.query(
            namespace=pc.namespace, 
            embedding_vec=qry,
            include_values=False,
            to_df=True,
            filter=filter,
            top_k=nmax, 
            neg=neg
        )

    # stop timers
    endx = time.time()
    time_taken = endx - startx

    if z.shape[0] > 0:
        # clean up results
        xx = z \
            .assign(title = lambda x: x.title.str.replace('\n', ' ')) \
            .drop_duplicates(subset=['title'], keep='first') \
            .sort_values(by='pcscore', ascending=False) \
            .assign(dt_published = lambda x: pd.to_datetime(x.dt_published, utc=True, format='mixed')) \
            .assign(date = lambda x: x.dt_published.dt.strftime('%d-%m-%Y')) \
            .assign(pcscore = lambda x: x.pcscore.round(3)) \
            .reset_index(drop=True) \
            .rename(columns={'base_url': 'basedomain'})
        
        # sort by time if requested
        if sort == 'time':
            xx = xx.sort_values(by='dt_published', ascending=False)

        # final cleanup
        xx = xx.reset_index(drop=True)
    else:
        xx = z.copy()
    return xx, time_taken