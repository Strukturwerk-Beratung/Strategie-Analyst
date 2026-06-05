import streamlit as st
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(
    page_title="Strategie-Analyst",
    page_icon="🔍",
    layout="wide",
)

st.title("🔍 Strategie-Analyst")
st.caption("AI-gestützte Unternehmensanalyse aus einer Website-URL")

# --- Sidebar: API Key Check ---
with st.sidebar:
    st.header("Konfiguration")
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY", "")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")

    if firecrawl_key and not firecrawl_key.startswith("fc-your"):
        st.success("✅ Firecrawl API Key gefunden")
    else:
        st.error("❌ FIRECRAWL_API_KEY fehlt in .env")

    if anthropic_key and not anthropic_key.startswith("sk-ant-your"):
        st.success("✅ Anthropic API Key gefunden")
    else:
        st.error("❌ ANTHROPIC_API_KEY fehlt in .env")

    st.markdown("---")
    st.markdown("**Setup:**")
    st.code("cp .env.example .env\n# dann API Keys eintragen", language="bash")

# --- Main Input ---
url = st.text_input(
    "Website URL",
    placeholder="https://www.beispielunternehmen.de",
    help="Startseite des zu analysierenden Unternehmens",
)

keys_ready = (
    firecrawl_key
    and not firecrawl_key.startswith("fc-your")
    and anthropic_key
    and not anthropic_key.startswith("sk-ant-your")
)

analyse_starten = st.button(
    "🚀 Analyse starten",
    disabled=not (url and keys_ready),
    type="primary",
)

if not keys_ready:
    st.warning("Bitte trage zuerst deine API Keys in die `.env` Datei ein (siehe Sidebar).")

# --- Run Analysis ---
if analyse_starten and url:
    from analyst import run_analysis

    with st.spinner("Inhalte werden gescrapt und analysiert… (ca. 1–2 Minuten)"):
        try:
            analysis, report = run_analysis(url)
            st.session_state["analysis"] = analysis
            st.session_state["report"] = report
            st.session_state["url"] = url
            st.success("✅ Analyse abgeschlossen")
        except Exception as e:
            st.error(f"Fehler bei der Analyse: {e}")
            st.stop()

# --- Display Results ---
if "report" in st.session_state:
    analysis = st.session_state["analysis"]
    report = st.session_state["report"]
    url_used = st.session_state["url"]

    up = analysis["unternehmensprofil"]
    score = analysis["analyse_score"]

    # Score Overview
    st.markdown("## Analyse-Score")
    col1, col2, col3, col4 = st.columns(4)
    score_items = [
        (col1, "Positionierung", score["positionierung"]["wert"]),
        (col2, "Zielgruppe", score["zielgruppenklarheit"]["wert"]),
        (col3, "Angebot", score["angebotsklarheit"]["wert"]),
        (col4, "Differenzierung", score["differenzierung"]["wert"]),
    ]
    for col, label, val in score_items:
        color = "normal" if val >= 7 else ("off" if val <= 4 else "normal")
        col.metric(label, f"{val}/10")

    st.markdown("---")

    # Full Report
    tab1, tab2 = st.tabs(["📊 Report", "📄 Markdown (Rohtext)"])

    with tab1:
        st.markdown(report)

    with tab2:
        st.code(report, language="markdown")

    # Download Button
    filename = (
        up.get("firmenname", "analyse")
        .lower()
        .replace(" ", "-")
        .replace("/", "-")
    )
    filename = f"strategie-analyse_{filename}_{datetime.now().strftime('%Y%m%d')}.md"

    st.download_button(
        label="⬇️ Markdown exportieren (.md)",
        data=report.encode("utf-8"),
        file_name=filename,
        mime="text/markdown",
        type="primary",
    )

    st.caption(f"Analysierte URL: {url_used}")
