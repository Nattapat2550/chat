const threadsEl = document.getElementById('threads');
const createBtn = document.getElementById('create-thread');
const newThreadName = document.getElementById('new-thread-name');
const threadTitle = document.getElementById('thread-title');
const renameBtn = document.getElementById('rename-thread');
const deleteBtn = document.getElementById('delete-thread');
const messagesEl = document.getElementById('messages');
const imageInput = document.getElementById('imageInput');
const preview = document.getElementById('preview');
const inputText = document.getElementById('inputText');
const sendBtn = document.getElementById('sendBtn');
const statusEl = document.getElementById('status');

let selectedThread = null;
let localImage = null;
let refreshInterval = null;

/* ---------------- THREAD HANDLING ---------------- */
async function loadThreads() {
  const res = await fetch('/api/threads'); 
  const threads = await res.json();
  threadsEl.innerHTML = '';
  threads.forEach(t => {
    const div = document.createElement('div');
    div.className = 'thread-item' + (selectedThread && selectedThread._id === t._id ? ' active' : '');
    div.textContent = t.name;
    div.onclick = () => { 
      selectedThread = t; 
      openThread(t); 
      loadThreads(); 
    };
    threadsEl.appendChild(div);
  });
}

async function openThread(t) {
  threadTitle.textContent = t.name;
  await loadMessages(t._id);

  // auto-refresh every 2s to catch AI updates
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => loadMessages(t._id), 2000);
}

async function loadMessages(threadId) {
  if (!threadId) return;
  const res = await fetch('/api/messages/' + threadId);
  const msgs = await res.json();
  renderMessages(msgs);
}

function renderMessages(msgs){
  messagesEl.innerHTML = '';
  msgs.forEach(m => {
    const div = document.createElement('div');
    div.className = 'msg ' + m.role;

    // render markdown/code
    let safeText = (m.text || "").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    // code block with triple backticks
    safeText = safeText.replace(/```([\s\S]*?)```/g, '<div class="code-block">$1</div>');
    // inline code with single backtick
    safeText = safeText.replace(/`([^`]+)`/g, '<code>$1</code>');
    // bold text
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    div.innerHTML = `<div>${safeText}</div>`;
    if (m.imagePath){ 
      const img = document.createElement('img'); 
      img.src = m.imagePath; 
      img.style.maxWidth="150px";
      div.appendChild(img); 
    }

    if (m.waiting) {
      div.classList.add('waiting');
    }

    messagesEl.appendChild(div);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* ---------------- THREAD BUTTONS ---------------- */
createBtn.onclick = async () => {
  const name = newThreadName.value || 'New';
  const res = await fetch('/api/threads', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name})
  });
  selectedThread = await res.json(); 
  loadThreads(); 
  openThread(selectedThread);
};

renameBtn.onclick = async () => {
  if (!selectedThread) return;
  const name = prompt('Rename', selectedThread.name); 
  if (!name) return;
  const res = await fetch('/api/threads/' + selectedThread._id, {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name})
  });
  selectedThread = await res.json(); 
  loadThreads(); 
  threadTitle.textContent = selectedThread.name;
};

deleteBtn.onclick = async () => {
  if (!selectedThread) return;
  if (!confirm('Delete?')) return;
  await fetch('/api/threads/' + selectedThread._id, { method:'DELETE' });
  selectedThread = null; 
  loadThreads(); 
  messagesEl.innerHTML = ''; 
  threadTitle.textContent = 'Select a channel';
  if (refreshInterval) clearInterval(refreshInterval);
};

/* ---------------- IMAGE PREVIEW ---------------- */
imageInput.onchange = e => {
  if (!e.target.files.length) return;
  localImage = e.target.files[0];
  preview.innerHTML = `
    <div style="position:relative;display:inline-block">
      <img src="${URL.createObjectURL(localImage)}" style="max-width:100px">
      <button id="removeImgBtn" style="position:absolute;top:0;right:0">✖</button>
    </div>
  `;
  document.getElementById("removeImgBtn").onclick = () => {
    localImage = null; 
    imageInput.value = ''; 
    preview.innerHTML = '';
  };
};

/* ---------------- SEND MESSAGE ---------------- */
sendBtn.onclick = async () => {
  if (!selectedThread) return;
  if (!inputText.value && !localImage) return;

  const form = new FormData();
  form.append('threadId', selectedThread._id);
  form.append('text', inputText.value);
  if (localImage) form.append('image', localImage);

  statusEl.textContent = 'Sending...';
  await fetch('/api/messages', { method:'POST', body:form });
  inputText.value = ''; 
  imageInput.value = ''; 
  preview.innerHTML = ''; 
  localImage = null;

  // reload quickly
  await loadMessages(selectedThread._id);
  statusEl.textContent = '';
};

loadThreads();
