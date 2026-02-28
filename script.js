class GeminiChat {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.messagesContainer = document.getElementById('messages');
        this.sendBtn = document.getElementById('sendBtn');
        this.chatForm = document.getElementById('chatForm');
        this.fileInput = document.getElementById('fileInput');
        this.attachBtn = document.getElementById('attachBtn');
        this.filePreview = document.getElementById('filePreview');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.themeBtns = document.querySelectorAll('.theme-btn');
        
        this.files = [];
        
        this.init();
    }
    
    init() {
        this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.messageInput.addEventListener('input', () => this.autoResize());
        this.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.attachBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.newChatBtn.addEventListener('click', () => this.newChat());
        
        
        this.themeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.changeTheme(btn.dataset.theme));
        });
        
        this.messagesContainer.addEventListener('dragover', (e) => e.preventDefault());
        this.messagesContainer.addEventListener('drop', (e) => this.handleDrop(e));
        
        const savedTheme = localStorage.getItem('chatTheme') || 'dark';
        this.changeTheme(savedTheme);
        
        this.messageInput.focus();
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        const message = this.messageInput.value.trim();
        if (!message && this.files.length === 0) return;
        
        this.addMessage(message, 'user', this.files);
        
        
        this.messageInput.value = '';
        this.autoResize();
        
        const formData = new FormData();
        formData.append('message', message);
        this.files.forEach(file => {
            formData.append('files', file);
        });
        
        this.setLoading(true);
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.addMessage(data.response, 'bot', null, data.files);
            } else {
                this.addMessage(`Error: ${data.error}`, 'bot');
            }
        } catch (error) {
            this.addMessage('Error de conexión con el servidor', 'bot');
        } finally {
            this.setLoading(false);
            this.clearFiles();
            this.scrollToBottom();
            if (window.Prism) {
                Prism.highlightAll();
            }
        }
    }
    
    addMessage(content, sender, files = null, metadata = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (sender === 'bot') {
            contentDiv.innerHTML = this.formatMessage(content);
        } else {
            contentDiv.textContent = content;
        }
        
        if (files && files.length > 0) {
            const filesDiv = document.createElement('div');
            filesDiv.className = 'file-metadata';
            filesDiv.innerHTML = '<i class="fas fa-paperclip"></i> <strong>Archivos:</strong><br>';
            files.forEach(file => {
                filesDiv.innerHTML += `📎 ${file.name} (${this.formatFileSize(file.size)})<br>`;
            });
            contentDiv.appendChild(filesDiv);
        }
        
        if (metadata && metadata.length > 0) {
            const metaDiv = document.createElement('div');
            metaDiv.className = 'file-metadata';
            metaDiv.innerHTML = '<i class="fas fa-info-circle"></i> <strong>Archivos procesados:</strong><br>';
            metadata.forEach(file => {
                metaDiv.innerHTML += `📁 ${file.nombre} (${file.tamaño_formateado})<br>`;
            });
            contentDiv.appendChild(metaDiv);
        }
        
        messageDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(messageDiv);
    }
    
    formatMessage(text) {
        text = this.escapeHtml(text);
        
        text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'plaintext';
            return `<pre><code class="language-${language}">${this.escapeHtml(code.trim())}</code></pre>`;
        });
        
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        text = text.replace(/\n/g, '<br>');
        
        return text;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    handleFileSelect(e) {
        const selectedFiles = Array.from(e.target.files);
        this.files = [...this.files, ...selectedFiles];
        this.updateFilePreview();
    }
    
    handleDrop(e) {
        e.preventDefault();
        const droppedFiles = Array.from(e.dataTransfer.files);
        this.files = [...this.files, ...droppedFiles];
        this.updateFilePreview();
    }
    
    updateFilePreview() {
        this.filePreview.innerHTML = '';
        
        this.files.forEach((file, index) => {
            const tag = document.createElement('div');
            tag.className = 'file-tag';
            
            const icon = this.getFileIcon(file.type);
            const name = file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name;
            
            tag.innerHTML = `
                <i class="fas ${icon}"></i>
                <span>${name}</span>
                <span class="remove" data-index="${index}">&times;</span>
            `;
            
            tag.querySelector('.remove').addEventListener('click', () => {
                this.files.splice(index, 1);
                this.updateFilePreview();
            });
            
            this.filePreview.appendChild(tag);
        });
    }
    
    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return 'fa-image';
        if (mimeType.startsWith('audio/')) return 'fa-music';
        if (mimeType.includes('pdf')) return 'fa-file-pdf';
        if (mimeType.includes('word')) return 'fa-file-word';
        if (mimeType.includes('text')) return 'fa-file-alt';
        return 'fa-file';
    }
    
    clearFiles() {
        this.files = [];
        this.fileInput.value = '';
        this.filePreview.innerHTML = '';
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    changeTheme(theme) {
        document.body.className = `theme-${theme}`;
        
        this.themeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
        
        localStorage.setItem('chatTheme', theme);
    }
    
    newChat() {
        this.messagesContainer.innerHTML = `
            <div class="message welcome">
                <div class="message-content">
                    <i class="fas fa-hand-wave"></i>
                    <h2>¡Hola! Soy Gemini</h2>
                    <p>Puedo ayudarte con texto e imágenes. ¿Qué necesitas hoy?</p>
                    <p class="hint">Puedes subir imágenes, documentos o audios</p>
                </div>
            </div>
        `;
        
        this.clearFiles();
        this.messageInput.focus();
    }
    
    setLoading(loading) {
        this.sendBtn.disabled = loading;
        this.sendBtn.innerHTML = loading ? 
            '<i class="fas fa-spinner fa-spin"></i>' : 
            '<i class="fas fa-paper-plane"></i>';
    }
    
    autoResize() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
    }
    
    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.chatForm.dispatchEvent(new Event('submit'));
        }
    }
    
    scrollToBottom() {
        const container = document.querySelector('.chat-container');
        container.scrollTop = container.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => new GeminiChat());

