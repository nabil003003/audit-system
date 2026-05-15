#!/usr/bin/env python3
# app_multiuser.py — RAG Audit Juridique Marocain — Multi-Rôles
import streamlit as st
import time
from datetime import datetime
from pathlib import Path

from database import (
    init_db, authenticate, create_user, get_all_users, get_users_by_role,
    create_audit, get_audits_by_client, get_pending_audits, assign_audit,
    get_audits_by_auditor, get_audit_by_id, save_report, get_all_audits
)
from config import (
    VECTOR_DB_PATH, COLLECTION_NAME, EMBEDDING_MODEL,
    RETRIEVAL_K, RETRIEVAL_TYPE, TEMPERATURE,
    AVAILABLE_MODELS, DEFAULT_MODEL, AUDIT_PROMPT_TEMPLATE,
)

st.set_page_config(
    page_title="AuditFlow Maroc",
    page_icon="⚖️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Bootstrap DB ──────────────────────────────────────────────
init_db()

# ── Session State ─────────────────────────────────────────────
if "user" not in st.session_state:
    st.session_state.user = None
if "selected_audit_id" not in st.session_state:
    st.session_state.selected_audit_id = None
if "audit_result" not in st.session_state:
    st.session_state.audit_result = None

# ── CSS Global ────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
* { font-family: 'Inter', sans-serif; }
.main { background: #080d1a; }

/* Login card */
.login-card {
    background: linear-gradient(135deg,#111827,#1a2235);
    border:1px solid #2a3a55;
    border-radius:16px;
    padding:2.5rem;
    max-width:420px;
    margin:4rem auto;
    box-shadow:0 20px 60px rgba(0,0,0,0.5);
}
.login-logo { text-align:center; font-size:3rem; margin-bottom:.5rem; }
.login-title {
    text-align:center;
    font-size:1.6rem;
    font-weight:800;
    background:linear-gradient(135deg,#c9a227,#f0d060);
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    margin-bottom:.3rem;
}
.login-sub { text-align:center; color:#64748b; font-size:.9rem; margin-bottom:2rem; }

/* Role badges */
.badge {
    display:inline-block;
    padding:4px 12px;
    border-radius:20px;
    font-size:.75rem;
    font-weight:700;
    letter-spacing:.5px;
    text-transform:uppercase;
}
.badge-admin   { background:#7c3aed22; color:#a78bfa; border:1px solid #7c3aed44; }
.badge-client  { background:#1d4ed822; color:#60a5fa; border:1px solid #1d4ed844; }
.badge-manager { background:#b4530622; color:#fb923c; border:1px solid #b4530644; }
.badge-auditor { background:#06664422; color:#34d399; border:1px solid #06664444; }

/* Status badges */
.status-pending   { background:#78350f22; color:#fbbf24; border:1px solid #78350f55; }
.status-assigned  { background:#1e3a5f22; color:#60a5fa; border:1px solid #1e3a5f55; }
.status-completed { background:#06664422; color:#34d399; border:1px solid #06664455; }

/* Cards */
.audit-card {
    background:linear-gradient(135deg,#111827,#162032);
    border:1px solid #1e3a5f;
    border-radius:12px;
    padding:1.2rem 1.5rem;
    margin:.7rem 0;
    transition:border-color .2s;
}
.audit-card:hover { border-color:#c9a227; }

/* User row */
.user-row {
    background:#111827;
    border:1px solid #1e2a3d;
    border-radius:8px;
    padding:.8rem 1.2rem;
    margin:.4rem 0;
    display:flex;
    align-items:center;
    gap:1rem;
}

/* Section title */
.section-title {
    font-size:1.4rem;
    font-weight:700;
    color:#e2e8f0;
    margin:1rem 0 .5rem;
}
.gold { color:#c9a227; }

/* Metrics */
.metric-mini {
    background:#111827;
    border:1px solid #1e3a5f;
    border-radius:8px;
    padding:.8rem;
    text-align:center;
}
.metric-mini .num { font-size:1.8rem; font-weight:800; color:#c9a227; }
.metric-mini .lbl { font-size:.75rem; color:#64748b; margin-top:.2rem; }

/* Sidebar user block */
.user-block {
    background:linear-gradient(135deg,#111827,#162032);
    border:1px solid #2a3a55;
    border-radius:10px;
    padding:1rem;
    margin-bottom:1rem;
}
.user-name { font-weight:700; color:#e2e8f0; font-size:1rem; }
.user-email { color:#64748b; font-size:.8rem; margin-top:.2rem; }

/* Buttons override */
.stButton>button {
    background:linear-gradient(135deg,#c9a227,#e8c547) !important;
    color:#0a0e1a !important;
    font-weight:700 !important;
    border:none !important;
    border-radius:8px !important;
    transition:all .2s !important;
}
.stButton>button:hover { transform:translateY(-1px); box-shadow:0 4px 16px rgba(201,162,39,.4) !important; }

/* Danger button */
.btn-danger>button {
    background:linear-gradient(135deg,#dc2626,#ef4444) !important;
    color:#fff !important;
}
</style>
""", unsafe_allow_html=True)


# ── RAG helpers ───────────────────────────────────────────────
@st.cache_resource(show_spinner="🧠 Chargement embeddings...")
def _load_embeddings():
    from langchain_community.embeddings import HuggingFaceEmbeddings
    return HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )

@st.cache_resource(show_spinner="💾 Connexion ChromaDB...")
def _load_vectorstore(_emb):
    from langchain_community.vectorstores import Chroma
    if not Path(VECTOR_DB_PATH).exists():
        return None
    return Chroma(
        persist_directory=VECTOR_DB_PATH,
        embedding_function=_emb,
        collection_name=COLLECTION_NAME,
    )

def _build_chain(vs, model, k):
    from langchain_community.llms import Ollama
    from langchain.chains import RetrievalQA
    from langchain.prompts import PromptTemplate
    llm = Ollama(model=model, temperature=TEMPERATURE,
                 num_ctx=AVAILABLE_MODELS[model].get("contexte_max", 4096))
    prompt = PromptTemplate(template=AUDIT_PROMPT_TEMPLATE,
                            input_variables=["context", "question"])
    retriever = vs.as_retriever(
        search_type=RETRIEVAL_TYPE,
        search_kwargs={"k": k, "fetch_k": k * 3}
    )
    return RetrievalQA.from_chain_type(
        llm=llm, chain_type="stuff", retriever=retriever,
        return_source_documents=True,
        chain_type_kwargs={"prompt": prompt},
    )


# ── Helpers UI ────────────────────────────────────────────────
ROLE_LABELS = {
    "admin": "🔴 Administrateur",
    "client": "🔵 Client",
    "manager": "🟡 Manager",
    "auditor": "🟢 Auditeur",
}
STATUS_LABELS = {
    "pending": "🟡 En attente",
    "assigned": "🔵 Assigné",
    "in_progress": "🟠 En cours",
    "completed": "🟢 Terminé",
}

def role_badge(role):
    return f'<span class="badge badge-{role}">{ROLE_LABELS.get(role, role)}</span>'

def status_badge(status):
    cls = f"status-{status}" if status in ("pending","assigned","completed") else "status-assigned"
    return f'<span class="badge {cls}">{STATUS_LABELS.get(status, status)}</span>'

def render_sidebar(user):
    with st.sidebar:
        st.markdown(f"""
        <div class="user-block">
            <div class="user-name">👤 {user['name']}</div>
            <div class="user-email">{user['email']}</div>
            <div style="margin-top:.6rem">{role_badge(user['role'])}</div>
        </div>
        """, unsafe_allow_html=True)
        st.markdown("---")
        if st.button("🚪 Se déconnecter", use_container_width=True):
            st.session_state.user = None
            st.session_state.selected_audit_id = None
            st.session_state.audit_result = None
            st.rerun()


# ══════════════════════════════════════════════════════════════
#  PAGE : LOGIN
# ══════════════════════════════════════════════════════════════
def show_login():
    st.markdown("""
    <div class="login-card">
        <div class="login-logo">⚖️</div>
        <div class="login-title">AuditFlow Maroc</div>
        <div class="login-sub">Plateforme d'audit juridique intelligente</div>
    </div>
    """, unsafe_allow_html=True)

    col = st.columns([1, 2, 1])[1]
    with col:
        with st.form("login_form"):
            st.markdown("### 🔐 Connexion")
            email = st.text_input("Email", placeholder="votre@email.com",
                                  label_visibility="visible")
            password = st.text_input("Mot de passe", type="password",
                                     placeholder="••••••••")
            submitted = st.form_submit_button("Se connecter", use_container_width=True)

        if submitted:
            if not email or not password:
                st.error("Veuillez remplir tous les champs.")
            else:
                user = authenticate(email, password)
                if user:
                    st.session_state.user = user
                    st.success(f"Bienvenue **{user['name']}** !")
                    time.sleep(0.8)
                    st.rerun()
                else:
                    st.error("❌ Email ou mot de passe incorrect.")

        st.markdown("""
        <div style="text-align:center;margin-top:2rem;color:#334155;font-size:.8rem;">
            ⚖️ RAG Audit Juridique Marocain — 100% local
        </div>
        """, unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════
#  PAGE : ADMIN
# ══════════════════════════════════════════════════════════════
def show_admin(user):
    render_sidebar(user)
    st.markdown('<h1 class="section-title">🔴 Dashboard <span class="gold">Administrateur</span></h1>',
                unsafe_allow_html=True)

    # KPIs
    all_users = get_all_users()
    all_audits = get_all_audits()
    c1, c2, c3, c4 = st.columns(4)
    for col, num, lbl in [
        (c1, len([u for u in all_users if u["role"]=="client"]), "Clients"),
        (c2, len([u for u in all_users if u["role"]=="manager"]), "Managers"),
        (c3, len([u for u in all_users if u["role"]=="auditor"]), "Auditeurs"),
        (c4, len(all_audits), "Missions Total"),
    ]:
        col.markdown(f'<div class="metric-mini"><div class="num">{num}</div><div class="lbl">{lbl}</div></div>',
                     unsafe_allow_html=True)

    st.markdown("---")
    tab1, tab2, tab3 = st.tabs(["➕ Créer un utilisateur", "👥 Liste des utilisateurs", "📋 Toutes les missions"])

    # ── Tab 1 : Créer utilisateur ──
    with tab1:
        st.markdown("### Nouvel utilisateur")
        with st.form("form_create_user"):
            nom    = st.text_input("Nom complet", placeholder="Prénom NOM")
            email  = st.text_input("Email", placeholder="utilisateur@email.com")
            pwd    = st.text_input("Mot de passe", type="password")
            role   = st.selectbox("Rôle", ["client", "manager", "auditor"],
                                  format_func=lambda r: ROLE_LABELS[r])
            ok = st.form_submit_button("✅ Créer l'utilisateur", use_container_width=True)
        if ok:
            if not all([nom, email, pwd]):
                st.error("Tous les champs sont obligatoires.")
            elif create_user(nom, email, pwd, role):
                st.success(f"✅ Utilisateur **{nom}** ({ROLE_LABELS[role]}) créé avec succès !")
                st.rerun()
            else:
                st.error("❌ Cet email existe déjà.")

    # ── Tab 2 : Liste des utilisateurs ──
    with tab2:
        st.markdown("### Liste des utilisateurs")
        for u in all_users:
            st.markdown(f"""
            <div class="user-row">
                <div style="flex:1"><b>{u['name']}</b><br>
                <span style="color:#64748b;font-size:.82rem">{u['email']}</span></div>
                <div>{role_badge(u['role'])}</div>
                <div style="color:#334155;font-size:.75rem">{u['created_at'][:16]}</div>
            </div>
            """, unsafe_allow_html=True)

    # ── Tab 3 : Toutes les missions ──
    with tab3:
        st.markdown("### Toutes les missions d'audit")
        if not all_audits:
            st.info("Aucune mission créée pour l'instant.")
        for a in all_audits:
            st.markdown(f"""
            <div class="audit-card">
                <b>#{a['id']} — {a['title']}</b>
                &nbsp;&nbsp;{status_badge(a['status'])}<br>
                <span style="color:#64748b;font-size:.82rem">
                Client : {a.get('client_name','?')} &nbsp;|&nbsp;
                Manager : {a.get('manager_name','—')} &nbsp;|&nbsp;
                Auditeur : {a.get('auditor_name','—')} &nbsp;|&nbsp;
                {a['created_at'][:16]}
                </span>
            </div>
            """, unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════
#  PAGE : CLIENT
# ══════════════════════════════════════════════════════════════
def show_client(user):
    render_sidebar(user)
    st.markdown('<h1 class="section-title">🔵 Dashboard <span class="gold">Client</span></h1>',
                unsafe_allow_html=True)

    tab1, tab2 = st.tabs(["📝 Nouvelle mission d'audit", "📂 Mes missions"])

    # ── Tab 1 : Soumettre un audit ──
    with tab1:
        st.markdown("### Soumettre un document à auditer")
        with st.form("form_new_audit"):
            titre = st.text_input("Titre de la mission",
                                  placeholder="ex: Audit contrat de travail — Société XYZ")
            doc   = st.text_area("Contenu du document à auditer",
                                 placeholder="Collez ici le texte du contrat, règlement, statuts...",
                                 height=280)
            ok = st.form_submit_button("📤 Soumettre la mission", use_container_width=True)
        if ok:
            if not titre or not doc.strip():
                st.error("Le titre et le document sont obligatoires.")
            else:
                aid = create_audit(titre, doc, user["id"])
                st.success(f"✅ Mission **#{aid} — {titre}** soumise avec succès !")
                st.balloons()
                st.rerun()

    # ── Tab 2 : Mes missions ──
    with tab2:
        st.markdown("### Mes missions en cours")
        audits = get_audits_by_client(user["id"])
        if not audits:
            st.info("Vous n'avez pas encore soumis de mission d'audit.")
        for a in audits:
            with st.expander(f"#{a['id']} — {a['title']}  |  {STATUS_LABELS.get(a['status'],'?')}"):
                st.markdown(f"**Statut :** {status_badge(a['status'])}", unsafe_allow_html=True)
                st.markdown(f"**Auditeur assigné :** {a.get('auditor_name') or '—'}")
                st.markdown(f"**Soumis le :** {a['created_at'][:16]}")
                if a.get("report"):
                    st.markdown("---")
                    st.markdown("### 📊 Rapport d'audit")
                    st.markdown(a["report"])
                    st.download_button(
                        "💾 Télécharger le rapport",
                        data=a["report"],
                        file_name=f"rapport_audit_{a['id']}.txt",
                        mime="text/plain",
                        key=f"dl_client_{a['id']}",
                    )


# ══════════════════════════════════════════════════════════════
#  PAGE : MANAGER
# ══════════════════════════════════════════════════════════════
def show_manager(user):
    render_sidebar(user)
    st.markdown('<h1 class="section-title">🟡 Dashboard <span class="gold">Manager</span></h1>',
                unsafe_allow_html=True)

    tab1, tab2 = st.tabs(["📋 Missions à assigner", "✅ Missions assignées"])

    pending = get_pending_audits()
    auditors = get_users_by_role("auditor")

    with tab1:
        st.markdown("### Missions en attente d'assignation")
        if not auditors:
            st.warning("⚠️ Aucun auditeur disponible. Demandez à l'admin d'en créer.")
            return
        if not pending:
            st.success("✅ Toutes les missions sont assignées !")
        for a in pending:
            if a["status"] == "pending":
                with st.expander(f"#{a['id']} — {a['title']}  |  Client : {a.get('client_name','?')}"):
                    st.markdown(f"**Document :** {a['document_text'][:200]}…")
                    options = {aud["id"]: aud["name"] for aud in auditors}
                    chosen_id = st.selectbox(
                        "Assigner à l'auditeur",
                        options=list(options.keys()),
                        format_func=lambda i: options[i],
                        key=f"sel_{a['id']}",
                    )
                    if st.button(f"✅ Assigner la mission #{a['id']}", key=f"btn_{a['id']}"):
                        assign_audit(a["id"], chosen_id, user["id"])
                        st.success(f"✅ Mission #{a['id']} assignée à **{options[chosen_id]}** !")
                        time.sleep(0.5)
                        st.rerun()

    with tab2:
        st.markdown("### Missions déjà assignées")
        assigned = [a for a in get_all_audits()
                    if a.get("manager_id") == user["id"]]
        if not assigned:
            st.info("Vous n'avez pas encore assigné de missions.")
        for a in assigned:
            st.markdown(f"""
            <div class="audit-card">
                <b>#{a['id']} — {a['title']}</b> &nbsp; {status_badge(a['status'])}<br>
                <span style="color:#64748b;font-size:.82rem">
                Auditeur : <b>{a.get('auditor_name','—')}</b> &nbsp;|&nbsp;
                Client : {a.get('client_name','—')} &nbsp;|&nbsp;
                {a['updated_at'][:16]}
                </span>
            </div>
            """, unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════
#  PAGE : AUDITEUR
# ══════════════════════════════════════════════════════════════
def show_auditor(user):
    render_sidebar(user)
    st.markdown('<h1 class="section-title">🟢 Dashboard <span class="gold">Auditeur</span></h1>',
                unsafe_allow_html=True)

    # Sidebar RAG config
    with st.sidebar:
        st.markdown("### 🤖 Modèle LLM")
        opts = list(AVAILABLE_MODELS.keys())
        labels = [f"{v['qualite']} {v['nom']} ({v['ram_requise']})" for v in AVAILABLE_MODELS.values()]
        idx = opts.index(DEFAULT_MODEL) if DEFAULT_MODEL in opts else 0
        modele = opts[st.selectbox("Modèle", range(len(opts)),
                                    format_func=lambda i: labels[i], index=idx,
                                    key="aud_model")]
        k_val = st.slider("Sources (k)", 1, 10, RETRIEVAL_K, key="aud_k")
        st.markdown("---")

    missions = get_audits_by_auditor(user["id"])
    tab1, tab2 = st.tabs(["📋 Mes missions", "🔍 Lancer l'analyse RAG"])

    with tab1:
        st.markdown("### Mes missions assignées")
        if not missions:
            st.info("Aucune mission ne vous est encore assignée.")
        for a in missions:
            with st.expander(f"#{a['id']} — {a['title']}  |  {STATUS_LABELS.get(a['status'],'?')}"):
                st.markdown(f"**Client :** {a.get('client_name','?')}")
                st.markdown(f"**Statut :** {status_badge(a['status'])}", unsafe_allow_html=True)
                st.markdown(f"**Reçu le :** {a['created_at'][:16]}")
                if a.get("report"):
                    st.markdown("---")
                    st.success("✅ Rapport généré")
                    with st.expander("Voir le rapport"):
                        st.markdown(a["report"])
                else:
                    if st.button(f"🔍 Analyser la mission #{a['id']}", key=f"sel_aud_{a['id']}"):
                        st.session_state.selected_audit_id = a["id"]
                        st.session_state.audit_result = None
                        st.rerun()

    with tab2:
        if not st.session_state.selected_audit_id:
            st.info("👆 Sélectionnez une mission dans **Mes missions** puis cliquez sur Analyser.")
            return

        audit = get_audit_by_id(st.session_state.selected_audit_id)
        if not audit:
            st.error("Mission introuvable.")
            return

        st.markdown(f"### 🔍 Analyse — Mission #{audit['id']} : {audit['title']}")
        with st.expander("📄 Document à analyser"):
            st.text_area("Contenu", audit["document_text"], height=200, disabled=True,
                         key="aud_doc_preview")

        # Check vector DB
        db_ok = Path(VECTOR_DB_PATH).exists()
        if not db_ok:
            st.error("❌ Base vectorielle introuvable. Exécutez `python 01_load_and_index.py`.")
            return

        # Show result if already computed
        if st.session_state.audit_result:
            res = st.session_state.audit_result
            st.markdown("---")
            st.markdown("## 📊 Résultats de l'audit RAG")
            c1, c2, c3 = st.columns(3)
            txt = res["texte"]
            c1.metric("Violations", txt.count("=== VIOLATION"))
            c2.metric("Critiques", txt.lower().count("critique"))
            c3.metric("Temps", f"{res['duree']:.1f}s")
            st.markdown("---")
            with st.expander("📋 Rapport complet", expanded=True):
                st.markdown(txt)

            # Save button
            col1, col2 = st.columns(2)
            with col1:
                if st.button("💾 Enregistrer le rapport", use_container_width=True):
                    save_report(audit["id"], txt)
                    st.success("✅ Rapport sauvegardé et mission marquée comme terminée !")
                    st.session_state.audit_result = None
                    st.session_state.selected_audit_id = None
                    time.sleep(0.8)
                    st.rerun()
            with col2:
                st.download_button(
                    "📥 Télécharger le rapport",
                    data=txt,
                    file_name=f"rapport_audit_{audit['id']}_{datetime.now().strftime('%Y%m%d_%H%M')}.txt",
                    mime="text/plain",
                    use_container_width=True,
                )
            return

        # Launch button
        if st.button(
            f"🚀 Lancer l'audit avec {AVAILABLE_MODELS[modele]['nom']}",
            use_container_width=True,
        ):
            with st.spinner(f"⚖️ Analyse en cours avec {modele}... (30-120s)"):
                try:
                    emb = _load_embeddings()
                    vs  = _load_vectorstore(emb)
                    if vs is None:
                        st.error("❌ Base vectorielle inaccessible.")
                        return
                    chain = _build_chain(vs, modele, k_val)
                    t0 = time.time()
                    resp = chain.invoke({"query": audit["document_text"]})
                    duree = time.time() - t0
                    st.session_state.audit_result = {
                        "texte": resp.get("result", ""),
                        "sources": resp.get("source_documents", []),
                        "duree": duree,
                    }
                    st.rerun()
                except Exception as e:
                    err = str(e).lower()
                    if "connection refused" in err or "connect" in err:
                        st.error("❌ **Ollama non démarré !** Lancez Ollama puis réessayez.")
                    elif "model" in err:
                        st.error(f"❌ Modèle absent. Téléchargez-le : `ollama pull {modele}`")
                    else:
                        st.error(f"❌ Erreur : {e}")


# ══════════════════════════════════════════════════════════════
#  ROUTEUR PRINCIPAL
# ══════════════════════════════════════════════════════════════
def main():
    user = st.session_state.user
    if user is None:
        show_login()
    elif user["role"] == "admin":
        show_admin(user)
    elif user["role"] == "client":
        show_client(user)
    elif user["role"] == "manager":
        show_manager(user)
    elif user["role"] == "auditor":
        show_auditor(user)
    else:
        st.error("Rôle inconnu.")
        if st.button("Déconnexion"):
            st.session_state.user = None
            st.rerun()

if __name__ == "__main__":
    main()
