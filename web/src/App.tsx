import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    MessageSquare,
    BarChart3,
    Settings,
    LogOut,
    ChevronRight,
    Send,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Filter,
    RefreshCw,
    PieChart,
    Clock
} from 'lucide-react';

interface Pipeline {
    id: number;
    name: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    data?: any;
}

function App() {
    const [activeTab, setActiveTab] = useState('chat');
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Olá! Sou o assistente do Kommo. Posso buscar dados reais dos funis Tryvion, Matriz ou Axion. O que deseja saber hoje?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [tabData, setTabData] = useState<any>(null);
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [sessionId, setSessionId] = useState<string | null>(null);

    useEffect(() => {
        fetchPipelines();
    }, []);

    const fetchPipelines = async () => {
        try {
            console.log("App: fetching pipelines...");
            const res = await axios.get('/api/pipelines');
            console.log("App: pipelines received:", res.data);
            setPipelines(res.data);
        } catch (e) {
            console.error("App: error fetching pipelines", e);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const res = await axios.post('/api/chat', { message: userMsg, sessionId });
            setSessionId(res.data.sessionId);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: res.data.response,
                data: res.data.data
            }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao processar sua mensagem.' }]);
        } finally {
            setLoading(false);
        }
    };

    const loadTabData = async (tab: string, useFilter: boolean = false) => {
        setActiveTab(tab);
        setLoading(true);
        if (!useFilter) setTabData(null);

        try {
            let res;
            if (tab === 'agents') {
                console.log("App: loading agent report...");
                res = await axios.get('/api/reports/agents');
                setTabData(res.data);
            } else if (tab.startsWith('brand-')) {
                const pid = tab.replace('brand-', '');
                console.log(`App: loading brand report for ${pid}...`);
                const params: any = {};
                if (fromDate) {
                    const startTs = new Date(fromDate + 'T00:00:00');
                    params.from = Math.floor(startTs.getTime() / 1000);
                }
                if (toDate) {
                    const endTs = new Date(toDate + 'T23:59:59');
                    params.to = Math.floor(endTs.getTime() / 1000);
                }

                res = await axios.get(`/api/leads/new/${pid}`, { params });
                console.log(`App: brand report data for ${pid}:`, res.data);
                setTabData(res.data);
            }
        } catch (e) {
            console.error("App: error loading tab data", e);
        } finally {
            setLoading(false);
        }
    };

    const renderContent = () => {
        if (activeTab === 'chat') {
            return (
                <div className="chat-container">
                    <div className="messages-list">
                        {messages.map((m, i) => (
                            <div key={i} className={`message-wrapper ${m.role === 'user' ? 'user' : 'assistant'}`}>
                                <div className="bubble glass">
                                    <div className="text">{m.content}</div>
                                    {m.data && (
                                        <div className="data-blob">
                                            <pre>{JSON.stringify(m.data, null, 2)}</pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="message-wrapper assistant">
                                <div className="bubble glass pulse">...</div>
                            </div>
                        )}
                    </div>
                    <form className="input-bar glass" onSubmit={handleSend}>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ex: Quantos leads na Tryvion hoje?"
                        />
                        <button type="submit" disabled={loading}>
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            );
        }

        const currentPipe = pipelines.find(p => `brand-${p.id}` === activeTab);
        const title = activeTab === 'agents' ? 'Relatório de Performance' : `Novos Leads: ${currentPipe?.name.replace('FUNIL ', '') || 'Marca'}`;

        return (
            <div className="tab-view">
                <header className="view-header">
                    <div className="title-area">
                        <h1>{title}</h1>
                        {tabData?.fetchedAt && (
                            <div className="timestamp" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
                                <Clock size={14} /> <span>Atualizado em: {tabData.fetchedAt}</span>
                            </div>
                        )}
                        {!tabData?.fetchedAt && !loading && tabData && (
                            <div className="timestamp" style={{ color: 'red' }}>Timestamp missing in data!</div>
                        )}
                    </div>
                    <div className="filter-controls glass">
                        <div className="field">
                            <span>De</span>
                            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        </div>
                        <div className="field">
                            <span>Até</span>
                            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </div>
                        <div className="actions">
                            <button className="primary" onClick={() => loadTabData(activeTab, true)}>
                                <Filter size={14} /> Filtrar
                            </button>
                            <button onClick={() => {
                                const today = new Date().toISOString().split('T')[0];
                                setFromDate(today);
                                setToDate(today);
                                loadTabData(activeTab);
                            }}>
                                Limpar
                            </button>
                        </div>
                    </div>
                </header>

                <section className="view-body">
                    {loading ? (
                        <div className="loading">
                            <RefreshCw className="spin" />
                            <span>Processando dados...</span>
                        </div>
                    ) : tabData ? (
                        activeTab === 'agents' ? (
                            <div className="table-card glass">
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                {Object.keys(tabData[0] || {}).map(k => <th key={k}>{k}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tabData.map((row: any, i: number) => (
                                                <tr key={i}>
                                                    {Object.entries(row).map(([key, v]: [string, any], j) => (
                                                        <td key={j} className={key === 'Ticket Médio' ? 'highlight-cell' : ''}>
                                                            {v}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="metrics-grid">
                                <div className="metric-box glass highlight">
                                    <span className="label">Leads Criados</span>
                                    <span className="value">{tabData.created}</span>
                                    <span className="sub">No período selecionado</span>
                                </div>
                                <div className="metric-box glass warning">
                                    <span className="label">Ainda na Etapa</span>
                                    <span className="value">{tabData.remaining}</span>
                                    <span className="sub">Novos leads sem movimento</span>
                                </div>
                                <div className="metric-box glass info">
                                    <span className="label">Período Selecionado</span>
                                    <span className="value small">{tabData.period}</span>
                                    <span className="sub">Filtro aplicado (GMT-3)</span>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="empty glass">
                            <PieChart size={48} />
                            <p>Clique em filtrar para visualizar os dados fidedignos para o período selecionado.</p>
                        </div>
                    )}
                </section>
            </div>
        );
    };

    return (
        <div className="app-layout">
            <aside className="sidebar glass">
                <div className="brand">
                    <div className="logo">KG</div>
                    <span>Kommo Agent</span>
                </div>

                <nav>
                    <div className="group">
                        <label>Principal</label>
                        <button
                            className={activeTab === 'chat' ? 'active' : ''}
                            onClick={() => setActiveTab('chat')}
                        >
                            <MessageSquare size={18} /> Chat Atual
                        </button>
                        <button
                            className={activeTab === 'agents' ? 'active' : ''}
                            onClick={() => loadTabData('agents')}
                        >
                            <BarChart3 size={18} /> Relatório Agentes
                        </button>
                    </div>

                    <div className="group">
                        <label>Marcas</label>
                        {pipelines.map(p => (
                            <button
                                key={p.id}
                                className={activeTab === `brand-${p.id}` ? 'active' : ''}
                                onClick={() => loadTabData(`brand-${p.id}`)}
                            >
                                <ChevronRight size={14} /> {p.name.replace('FUNIL ', '').substring(0, 15)}
                            </button>
                        ))}
                    </div>
                </nav>

                <div className="user-section">
                    <button className="settings-btn"><Settings size={18} /></button>
                    <button className="logout-btn"><LogOut size={18} /></button>
                </div>
            </aside>

            <main className="content">
                {renderContent()}
            </main>
        </div>
    );
}

export default App;
