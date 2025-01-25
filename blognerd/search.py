import streamlit as st
from streamlit_lottie import st_lottie
from blognerd.pc import search_pc
from blognerd.utils import update_last_interaction
import json
import time

def set_query_params():
    param_dict = {}
    if st.session_state.search_query:
        param_dict['qry'] = st.session_state.search_query
    if st.session_state.search_type:
        param_dict['type'] = st.session_state.search_type
    if st.session_state.search_content:
        param_dict['content'] = st.session_state.search_content
    if st.session_state.search_time:
        param_dict['time'] = st.session_state.search_time
    st.query_params.from_dict(param_dict)

def render_animation():
    # read json file
    with open('blognerd/www/lottie.json') as f:
        animation_json = json.load(f)   
    return st_lottie(animation_json, height=200, width=300)

def run_search(search_input, nresults: int = 50):
    update_last_interaction()
    # is feed search
    is_feed_search = True if 'type:feeds' in search_input else False

    # run the search in Pinecone
    results, time_taken = search_pc(
        qry=search_input,
        nmax=nresults,
        )

    if results.shape[0] > 0:
        # Function to handle the button click
        def get_more_like_this(button_key):
            st.session_state.counter += 1
            st.session_state['results_container'].empty()
            st.session_state.search_query = 'like:' + button_key.split('|||')[0]
            st.session_state.search_type = 'pages'
            # st.query_params.from_dict(param_dict)
        
        # Function to handle the button click
        def create_get_more_button_click_handler(button_key):
            def button_click_handler():
                get_more_like_this(button_key)
            return button_click_handler

        # Function to handle the button click
        def get_more_from_site(button_key):
            st.session_state.counter += 1
            st.session_state['results_container'].empty()
            st.session_state.search_type = 'pages'
            st.session_state.search_content = None
            st.session_state.search_query = 'sort:time site:' + button_key

        # Function to handle the button click
        def create_from_site_button_click_handler(button_key):
            def button_click_handler():
                get_more_from_site(button_key)
            return button_click_handler
        
        # Show number of results and time taken
        st.session_state['results_container'] = st.empty()
        with st.session_state['results_container']:
            st.write(
                number_of_results(nresults, time_taken),
                unsafe_allow_html=True
                )

        # Your loop to create buttons
        for i, res in enumerate(results.to_dict(orient='records')):
            st.write(search_result(i, **res), unsafe_allow_html=True)
            if not is_feed_search:
                # Generate a unique click handler for each button
                get_more_button_click_handler = create_get_more_button_click_handler(res['url'])

            # Generate a unique click handler for each button
            from_site_button_click_handler = create_from_site_button_click_handler(res['basedomain'])
            
            # Create two columns for the buttons
            col1, col2  = st.columns([1, 1])
            int_timestamp_now = str(int(time.time()))

            with col1:
                if not is_feed_search:
                    st.button(
                        '→ More like this',
                        key=res['url'] + '|||' + int_timestamp_now,
                        on_click=get_more_button_click_handler, 
                        )
                else:
                    st.button(
                        '→ From this site',
                        key=res['url'] + '|||' + res['basedomain'] + '|||' + int_timestamp_now,
                        on_click=from_site_button_click_handler, 
                        )

            with col2:   
                if not is_feed_search:  
                    st.button(
                        '→ From this site',
                        key=res['url'] + '|||' + res['basedomain'] + '|||' + int_timestamp_now,
                        on_click=from_site_button_click_handler, 
                        )
    else:
        st.write(no_result_html(), unsafe_allow_html=True)
    st.session_state.last_search_query = st.session_state.search_query
    
def set_session_state():
    """
    Set session state variables for search.
    """
    # default values
    if 'search_input_state' not in st.session_state:
        st.session_state.search_query_state = ""
    if 'search_type_state' not in st.session_state:
        st.session_state.search_type_state = ""

def no_result_html() -> str:
    """ """
    return """
        <div style="color:grey;font-size:95%;margin-top:0.5em;">
            No results were found.
        </div>
    """

def number_of_results(total_hits: int, duration: float) -> str:
    """ HTML scripts to display number of results and time taken. """
    return f"""
        <div style="color:grey;font-size:95%;">
            {total_hits} results ({duration:.2f} seconds)
        </div>
        <br>
    """

def search_result(i: int, url: str, title: str, subtitle: str,
                  date: str, pcscore: float, **kwargs) -> str:
    """ HTML scripts to display search results. """
    return f"""
        <div style="font-size:120%;">
            <a href="{url}">
                {title}
            </a>
        </div>
        <div style="font-size:95%;">
            <div style="color:grey;font-size:95%;">
                {date} &nbsp; ({pcscore}) &nbsp;{url[:90] + '...' if len(url) > 100 else url}
            </div>
            {subtitle}
        </div>
    """


def update_search():
    set_query_params()
    try:
        if "counter" not in st.session_state:
            st.session_state.counter = 1

        if st.session_state.search_query is None or st.session_state.search_query == '':
            # query to run on startup when no search query is provided
            spinner_container = st.empty()
            with spinner_container:
                _, col, _ = st.columns([3, 6, 3])
                with col:
                    render_animation()
            run_search(
                'ai, software development, startups, tech, data, computers since:last_3days length:1000 type:blog score:0.6 lang:en',
                nresults=50
                )
            spinner_container.empty()
        else:
            # create meta query string depending options picked
            qry = st.session_state.search_query
            if "sites" in st.session_state.search_type:
                qry += ' type:feeds'
            else:
                if st.session_state.search_content:
                    qry = qry + ' type:' + st.session_state.search_content
                if st.session_state.search_time:
                    qry = qry + ' since:last_' + st.session_state.search_time
            
            # actually run the search
            spinner_container = st.empty()
            with spinner_container:
                _, col, _ = st.columns([3, 6, 3])
                with col:
                    render_animation()
            run_search(qry, nresults=50)
            spinner_container.empty()

    except Exception as e:
        print(e)
        try:
            spinner_container.empty()
        except:
            pass
        st.write('<br>', unsafe_allow_html=True)
        st.write('Oops! Something went wrong. Please refresh the page and try again.')
        st.image('blognerd/www/beaker.gif', use_container_width=False)

def update_results(container):
    """Wrapper function to update search results in the specified container"""
    with container:
        update_search()