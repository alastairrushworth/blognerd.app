import streamlit as st
import time
import base64
from datetime import datetime

def update_last_interaction():
    st.session_state.last_interaction = datetime.now()

def img_to_bytes(img_path):
    with open(img_path, "rb") as img_file:
        encoded = base64.b64encode(img_file.read()).decode()
    return encoded

def logo_html(img_path, alt="blaze logo"):
    img_html = "<img src='data:image/png;base64,{im}' width={wi} style='display: block; margin-left: auto; margin-right: auto;' alt='{alt}'>".format(
        im=img_to_bytes(img_path),
        wi='80px',
        alt=alt
    )
    return img_html

def action_button(url, text):
    btn = st.markdown(
        f"""
        <a href="{url}" target="_blank">
            <div style="
                display: inline-block;
                width: 100%;
                padding: 0.5em 1em;
                color: #FFFFFF;
                background-color: #FD504D;
                border-radius: 8px;
                text-align: center;
                text-decoration: none;">
                {text}
            </div>
        </a>
    """,
        unsafe_allow_html=True,
    )
    return btn


# convert unix time to human readable time
def convert_unix_time(unix_time):
    return time.strftime('%d/%m/%Y', time.localtime(unix_time))