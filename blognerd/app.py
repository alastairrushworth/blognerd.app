import streamlit as st

from blognerd.search import update_results
from datetime import datetime, timedelta
from blognerd.css import load_css

# Load custom CSS
load_css()

def initialize_session_state():
    """Initialize all session state variables"""
    if 'last_interaction' not in st.session_state:
        st.session_state.last_interaction = datetime.now()
    if 'results_container' not in st.session_state:
        st.session_state.results_container = None
    if 'last_search_query' not in st.session_state:
        st.session_state.last_search_query = ''

initialize_session_state()

param_dict = st.query_params.to_dict()

# Check session timeout
if datetime.now() - st.session_state.last_interaction > timedelta(minutes=15):
    st.warning("Session has been idle for a while. Please refresh the page to continue.")
    st.stop()

# Create containers for layout control
search_container = st.container()
results_container = st.container()

# Render navbar in its dedicated container
with search_container:
    st.markdown('### 🤓 blognerd.app: search blogs and the small web')
    st.text_input(
        label='search',
        key='search_query',
        placeholder='🔎  search for something', 
        label_visibility='collapsed', 
        value=param_dict['qry'] if 'qry' in param_dict else '',
        on_change=lambda: update_results(results_container)
    )
    with st.expander('Search settings', expanded=False, icon='⚙️'):
        col1, col2, col3 = st.columns([3, 4, 5])
        with col1:
            type_options = ["pages", "sites"]
            st.segmented_control(
                label="Searching for",
                key='search_type',
                options=type_options,
                default=param_dict['type'] if 'type' in param_dict else 'pages',
                selection_mode="single",
                on_change=lambda: update_results(results_container)
            )
        with col2:
            content_options = ["blogs", "academic", "news"]
            st.segmented_control(
                label="Including",
                default=param_dict['content'] if 'content' in param_dict else [],
                key='search_content',
                disabled=True if "pages" not in st.session_state.search_type else False,
                options=content_options,
                selection_mode="single",
                on_change=lambda: update_results(results_container)
            )
        with col3:
            time_options = ["week", "month", "year"]
            st.segmented_control(
                label="Since last",
                key='search_time',
                default=param_dict['time'] if 'time' in param_dict else [],
                disabled=True if "pages" not in st.session_state.search_type else False,
                options=time_options,
                selection_mode="single",
                on_change=lambda: update_results(results_container)
            )
        if st.session_state.get('search_query') != st.session_state.last_search_query:
            update_results(results_container)
            st.session_state.last_search_query = st.session_state.get('search_query')
# Store the results container in session state for access from callbacks
st.session_state.results_container = results_container

# Initial search if needed
if not st.session_state.get('search_query'):
    update_results(results_container)


