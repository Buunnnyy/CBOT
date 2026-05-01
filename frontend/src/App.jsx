import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Send, FileText, MessageCircle, Sparkles, User, Bot, Loader2, ArrowDown, Trash2, X, HardDrive } from 'lucide-react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:5000';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function App() {
  const [uploading, setUploading] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [totalSize, setTotalSize] = useState(0);
  const maxSize = 200 * 1024 * 1024;

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Fix: always scroll to top on page load ──
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    // Extra insurance for slower browsers
    const timer = setTimeout(() => window.scrollTo(0, 0), 100);
    return () => clearTimeout(timer);
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load existing files on mount
  const fetchFiles = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/files`);
      setUploadedFiles(res.data.files);
      setTotalSize(res.data.totalSize);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    // Reset file input so same file can be re-selected later
    if (fileInputRef.current) fileInputRef.current.value = '';

    setUploading(true);
    setIndexingStatus(`Indexing "${selectedFile.name}"... 📚`);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await axios.post(`${API_BASE}/upload`, formData);
      setIndexingStatus(`✅ "${res.data.fileName}" is ready! (${res.data.chunks} chunks)`);
      setTimeout(() => setIndexingStatus(''), 4000);
      fetchFiles();
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Unknown error';
      setIndexingStatus(`❌ ${msg}`);
      setTimeout(() => setIndexingStatus(''), 6000);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = async (fileName) => {
    try {
      await axios.delete(`${API_BASE}/files/${encodeURIComponent(fileName)}`);
      fetchFiles();
    } catch (_) {}
  };

  const handleClearAll = async () => {
    try {
      await axios.delete(`${API_BASE}/files`);
      setUploadedFiles([]);
      setTotalSize(0);
      setMessages([]);
    } catch (_) {}
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        message: input,
        history: messages
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong, dude! 😵 Try again?" }]);
    } finally {
      setLoading(false);
    }
  };

  const storagePercent = Math.min((totalSize / maxSize) * 100, 100);
  const storageColor = storagePercent > 85 ? '#ef4444' : storagePercent > 60 ? '#f59e0b' : '#6366f1';

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar glass-card">
        <div className="nav-content">
          <div className="logo">
            <Sparkles className="logo-icon" />
            <span>CBOT</span>
          </div>
          <div className="nav-links">
            <button onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>Features</button>
            <button onClick={() => document.getElementById('chat').scrollIntoView({ behavior: 'smooth' })} className="btn-primary">Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="hero-content"
        >
          <div className="badge">
            <Sparkles size={14} />
            <span>AI Document Friend</span>
          </div>
          <h1>Chat with your documents, <br /><span className="gradient-text">effortlessly.</span></h1>
          <p>Upload up to 200MB of PDFs & text files and start a conversation. Your smartest friend who knows everything in your files!</p>

          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="scroll-indicator"
            onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
          >
            <ArrowDown />
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header">
            <h2>Why you'll love <span className="gradient-text">CBOT</span></h2>
            <p>Built for speed, accuracy, and true friendship.</p>
          </div>
          <div className="features-grid">
            <motion.div whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 30 }} viewport={{ once: true }} className="feature-card glass-card">
              <div className="feature-icon"><FileText /></div>
              <h4>Multi-Doc Support</h4>
              <p>Upload up to 200MB across 10–15 documents. All indexed together, ready to answer anything.</p>
            </motion.div>
            <motion.div whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 30 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="feature-card glass-card">
              <div className="feature-icon"><Sparkles /></div>
              <h4>Friendly Vibes</h4>
              <p>No robotic jargon. Just clean, helpful talk from a friend who knows your files inside out.</p>
            </motion.div>
            <motion.div whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 30 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="feature-card glass-card">
              <div className="feature-icon"><MessageCircle /></div>
              <h4>Instant Answers</h4>
              <p>Ask anything. From summaries to deep specifics across all your documents, we've got you covered.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main App Section */}
      <section id="chat" className="main-section">
        <div className="container">
          <div className="layout">

            {/* Upload Panel */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="upload-panel glass-card"
            >
              <div className="panel-header">
                <FileText className="icon" />
                <h3>Knowledge Base</h3>
                {uploadedFiles.length > 0 && (
                  <button className="clear-btn" onClick={handleClearAll} title="Clear all documents">
                    <Trash2 size={14} />
                    <span>Clear All</span>
                  </button>
                )}
              </div>

              {/* Storage bar */}
              {uploadedFiles.length > 0 && (
                <div className="storage-bar-container">
                  <div className="storage-label">
                    <HardDrive size={12} />
                    <span>{formatBytes(totalSize)} / 200MB used</span>
                  </div>
                  <div className="storage-bar">
                    <div className="storage-fill" style={{ width: `${storagePercent}%`, background: storageColor }} />
                  </div>
                </div>
              )}

              {/* Uploaded files list */}
              {uploadedFiles.length > 0 && (
                <div className="files-list">
                  {uploadedFiles.map((file, i) => (
                    <motion.div
                      key={file.fileName}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="file-item"
                    >
                      <div className="file-dot" />
                      <div className="file-meta">
                        <span className="file-name">{file.fileName}</span>
                        <span className="file-size">{formatBytes(file.size)} · {file.chunks} chunks</span>
                      </div>
                      <button className="remove-file-btn" onClick={() => handleRemoveFile(file.fileName)} title="Remove this document">
                        <X size={13} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Upload dropzone */}
              <label className={`dropzone ${uploading ? 'uploading' : ''}`}>
                <input ref={fileInputRef} type="file" onChange={handleUpload} accept=".pdf,.txt" hidden disabled={uploading} />
                {uploading ? <Loader2 className="upload-icon spin" /> : <Upload className="upload-icon" />}
                <p>{uploading ? 'Indexing...' : 'Upload your doc here'}</p>
                <span>Max 200MB total · PDF, TXT</span>
              </label>

              {/* Status message */}
              <AnimatePresence>
                {indexingStatus && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="status-toast"
                  >
                    <span>{indexingStatus}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Chat Panel */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="chat-panel glass-card"
            >
              <div className="panel-header">
                <div className="icon-wrapper chat-icon-wrapper">
                  <MessageCircle className="icon" />
                </div>
                <h3>Hey bro!</h3>
              </div>

              <div className="messages-container">
                {messages.length === 0 && (
                  <div className="empty-state">
                    <Bot size={48} className="bot-icon" />
                    <h4>Hey bro!</h4>
                    <p>Upload a file to start chatting. I'm ready when you are!</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`message ${msg.role}`}
                  >
                    <div className="avatar">
                      {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div className="bubble">
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <div className="message assistant loading">
                    <div className="avatar"><Bot size={16} /></div>
                    <div className="bubble">
                      <div className="typing-dots">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="input-area">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask me anything about your documents..."
                />
                <button onClick={handleSend} disabled={loading}>
                  <Send size={18} />
                </button>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Background blobs */}
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
    </div>
  );
}

export default App;
