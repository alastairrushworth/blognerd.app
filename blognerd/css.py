import streamlit as st

def load_css():
    css = """
        <style>
        #MainMenu, header, footer {visibility: hidden;}
        .margin-class {
            margin: 0px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 0px !important;
            background-color: #0E1117;
        }
        .logo img {
            display: block;
            height: auto;
            width: 50px;
            margin: 0px;
            padding: 0px;
        }
        .navigation a {
            text-decoration: none;
            color: inherit;
            font-size: 20px;
            padding: 0 8px;
        }
        button[kind="secondary"] {
            background-color: transparent !important;
            color: #d4982a !important;
            border-color: transparent !important;
            padding: 0px !important;
            margin: 0px !important;
            line-height: 0.8 !important;
            font-size: inherit !important;
        }
        .block-container {
            max-width: 900px;
            padding-top: 1rem !important;
            padding-bottom: 1rem;
            padding-left: 5rem;
            padding-right: 5rem;
            margin: 0 auto !important;
        }
        .st-emotion-cache-keje6w {
            min-width: 0 !important;
        }

        /* Mobile-specific styles */
        @media (max-width: 768px) {
            .block-container {
                padding-left: 1rem !important;
                padding-right: 1rem !important;
            }
        }
        </style>
        """
    st.markdown(css, unsafe_allow_html=True)