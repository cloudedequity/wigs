// client.js
// This file contains all the client-side logic for the WIG tracker.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, collection, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Constants & Global State ---
const DEPARTMENTS = [
    "Tech & Digital", "Strategy & Compliance", "Marketing & Engagement",
    "Sales & Operations", "Production & Logistics"
];

// firebaseConfig is now available globally from the EJS template
const appId = firebaseConfig.projectId || 'default-wig-app-dept-html';

let db, auth;
let currentView = 'dashboard';
let selectedDept = DEPARTMENTS[0];
let weekId = getWeekId();
let currentWigUnsubscribe = () => {};
let historyUnsubscribe = () => {};

// --- DOM Elements ---
const appContainer = document.getElementById('app-container');
const tabDashboard = document.getElementById('tab-dashboard');
const tabHistory = document.getElementById('tab-history');
const viewDashboard = document.getElementById('view-dashboard');
const viewHistory = document.getElementById('view-history');
const deptSelect = document.getElementById('department-select');
const dashboardContent = document.getElementById('dashboard-content');
const footerWeekId = document.getElementById('footer-week-id');
const modal = document.getElementById('wig-details-modal');

// --- Helper Functions ---
function getWeekId(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function calculateProgress(wig) {
    if (!wig || !wig.tasks || wig.tasks.length === 0) return 0;
    const completed = wig.tasks.filter(t => t.completed).length;
    return Math.round((completed / wig.tasks.length) * 100);
}

// --- Rendering Functions ---
function render() {
    tabDashboard.classList.toggle('tab-active', currentView === 'dashboard');
    tabDashboard.classList.toggle('tab-inactive', currentView !== 'dashboard');
    tabHistory.classList.toggle('tab-active', currentView === 'history');
    tabHistory.classList.toggle('tab-inactive', currentView !== 'history');

    viewDashboard.style.display = currentView === 'dashboard' ? 'block' : 'none';
    viewHistory.style.display = currentView === 'history' ? 'block' : 'none';
    
    currentWigUnsubscribe();
    historyUnsubscribe();
    
    if (currentView === 'dashboard') {
        subscribeToCurrentWig();
    } else {
        subscribeToHistory();
    }
}

function renderWigSetup() {
    dashboardContent.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
            <h2 class="text-xl font-bold text-gray-800 dark:text-white mb-4">Set WIG for ${selectedDept}</h2>
            <form id="wig-setup-form">
                <input type="text" id="new-wig-title" placeholder="e.g., Increase customer retention by 5%" class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-transparent rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"/>
                <button type="submit" class="w-full mt-4 px-4 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">Set Weekly Goal</button>
            </form>
        </div>`;
    document.getElementById('wig-setup-form').addEventListener('submit', handleSetWig);
}

function renderWigDashboard(wig) {
    const progress = calculateProgress(wig);
    const isAbandoned = wig.status === 'abandoned';
    const currentStatus = wig.status || 'active';

    dashboardContent.innerHTML = `
        <div class="transition-opacity ${isAbandoned ? 'opacity-60' : ''}">
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 relative">
                ${isAbandoned ? '<div class="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">ABANDONED</div>' : ''}
                <p class="text-sm text-gray-500 dark:text-gray-400">${wig.department} - Week ${wig.weekId}</p>
                <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-1">${wig.title}</h1>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
                <div class="flex justify-between items-center">
                    <h2 class="font-bold text-lg text-gray-800 dark:text-white">Progress</h2>
                    ${!isAbandoned ? `
                    <div class="status-dropdown">
                        <button class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200">Edit Status</button>
                        <div class="status-dropdown-content">
                            <a href="#" class="status-change-btn" data-status="active">Active</a>
                            <a href="#" class="status-change-btn" data-status="completed">Completed</a>
                            <a href="#" class="status-change-btn" data-status="not-completed">Not Completed</a>
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="flex items-center mt-3">
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4"><div class="bg-green-500 h-4 rounded-full transition-all" style="width: ${progress}%"></div></div>
                    <span class="ml-4 text-lg font-semibold text-gray-700 dark:text-gray-300">${progress}%</span>
                </div>
                 <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Current Status: <span class="font-semibold">${currentStatus.replace('-', ' ')}</span></p>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h2 class="font-bold text-lg text-gray-800 dark:text-white mb-4">Weekly Commitments</h2>
                ${!isAbandoned ? `
                <form id="add-task-form" class="flex gap-2 mb-4">
                    <input type="text" id="new-task-desc" placeholder="Add a commitment..." class="flex-grow px-4 py-2 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:ring-2 focus:ring-indigo-500"/>
                    <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
                </form>` : ''}
                <div id="task-list" class="space-y-3"></div>
            </div>
            ${!isAbandoned ? `
            <div class="mt-6 flex justify-end">
                <button id="abandon-wig-btn" class="flex items-center px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 font-semibold rounded-lg hover:bg-red-200 dark:hover:bg-red-900">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 mr-2"><path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                    Abandon WIG
                </button>
            </div>` : ''}
        </div>`;
    
    renderTaskList(wig.tasks, isAbandoned);

    if (!isAbandoned) {
        document.getElementById('add-task-form').addEventListener('submit', (e) => handleAddTask(e, wig));
        document.getElementById('abandon-wig-btn').addEventListener('click', () => handleAbandonWig(wig));
        document.querySelectorAll('.status-change-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleStatusChange(e, wig));
        });
    }
}

function renderTaskList(tasks, isAbandoned) {
    const taskListContainer = document.getElementById('task-list');
    if (!taskListContainer) return;
    taskListContainer.innerHTML = (tasks || []).map(task => `
        <div class="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div class="task-toggle ${isAbandoned ? '' : 'cursor-pointer'}" data-task-id="${task.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 ${task.completed ? 'text-green-500' : 'text-gray-400 hover:text-green-500'}">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    ${task.completed ? '<polyline points="22 4 12 14.01 9 11.01"></polyline>' : ''}
                </svg>
            </div>
            <p class="flex-grow mx-3 text-gray-800 dark:text-gray-200 ${task.completed ? 'line-through text-gray-500' : ''}">${task.description}</p>
            ${!isAbandoned ? `<button class="task-delete text-gray-400 hover:text-red-500" data-task-id="${task.id}"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>` : ''}
        </div>
    `).join('');

    if (!isAbandoned) {
        document.querySelectorAll('.task-toggle').forEach(btn => btn.addEventListener('click', (e) => handleToggleTask(e.currentTarget.dataset.taskId, tasks)));
        document.querySelectorAll('.task-delete').forEach(btn => btn.addEventListener('click', (e) => handleDeleteTask(e.currentTarget.dataset.taskId, tasks)));
    }
}

function renderHistory(allWigs) {
    const groupedWigs = allWigs.reduce((acc, wig) => {
        (acc[wig.weekId] = acc[wig.weekId] || []).push(wig);
        return acc;
    }, {});

    const sortedWeeks = Object.keys(groupedWigs).sort().reverse();
    
    viewHistory.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 class="text-xl font-bold text-gray-800 dark:text-white mb-4">WIG History</h2>
            <div class="space-y-6">
                ${sortedWeeks.length === 0 ? '<p class="text-center text-gray-500 py-4">No history to display.</p>' : sortedWeeks.map(week => `
                    <div>
                        <h3 class="text-lg font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">${week}</h3>
                        <div class="space-y-2">
                            ${groupedWigs[week].map(wig => {
                                const status = wig.status || 'active';
                                const statusClasses = {
                                    active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
                                    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
                                    'not-completed': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
                                    abandoned: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
                                };

                                return `
                                <div class="history-item flex justify-between items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" data-wig-id="${wig.id}">
                                    <div>
                                        <p class="font-medium text-gray-900 dark:text-gray-100">${wig.department}</p>
                                        <p class="text-sm text-gray-600 dark:text-gray-400">${wig.title}</p>
                                    </div>
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses[status]}">${status.replace('-', ' ')}</span>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;

    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const wig = allWigs.find(w => w.id === item.dataset.wigId);
            if (wig) renderModal(wig);
        });
    });
}

function renderModal(wig) {
    const progress = calculateProgress(wig);
    const status = wig.status || 'active';
    modal.classList.add('is-open');
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">${wig.department} - ${wig.weekId}</h2>
            <button id="modal-close-btn" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
        <div class="mb-4">
            <p class="text-sm text-gray-500 dark:text-gray-400">Wildly Important Goal</p>
            <p class="text-lg font-semibold text-gray-800 dark:text-gray-100">${wig.title}</p>
        </div>
        <div class="mb-4">
            <p class="text-sm text-gray-500 dark:text-gray-400">Status</p>
            <p class="text-lg font-semibold text-gray-800 dark:text-gray-100 capitalize">${status.replace('-', ' ')}</p>
        </div>
        <div class="mb-4">
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">Progress</p>
            <div class="flex items-center">
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5"><div class="bg-green-500 h-2.5 rounded-full" style="width: ${progress}%"></div></div>
                <span class="ml-3 font-semibold text-sm">${progress}%</span>
            </div>
        </div>
        <div>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Commitments</p>
            <div class="space-y-2">
                ${(wig.tasks || []).length > 0 ? wig.tasks.map(task => `
                    <div class="flex items-center p-2 rounded ${task.completed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-700/50'}">
                        <input type="checkbox" ${task.completed ? 'checked' : ''} disabled class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                        <span class="ml-3 ${task.completed ? 'line-through text-gray-500' : ''}">${task.description}</span>
                    </div>
                `).join('') : '<p class="text-sm text-gray-500">No commitments for this WIG.</p>'}
            </div>
        </div>
    `;
    document.getElementById('modal-close-btn').addEventListener('click', () => modal.classList.remove('is-open'));
}

// --- Firestore Actions & Handlers ---
async function saveWigData(docId, data) {
    if (!db) return;
    const wigDocRef = doc(db, 'artifacts', appId, 'public/data/wigs', docId);
    try {
        await setDoc(wigDocRef, data, { merge: true });
    } catch (err) {
        console.error("Error saving WIG:", err);
        alert("Could not save data. Please try again.");
    }
}

function handleSetWig(e) {
    e.preventDefault();
    const title = document.getElementById('new-wig-title').value;
    if (!title.trim()) return;
    const docId = `${selectedDept}-${weekId}`.replace(/[\s&/]/g, '_');
    const wigData = {
        title: title.trim(),
        department: selectedDept,
        weekId,
        tasks: [],
        status: 'active',
        createdAt: new Date().toISOString(),
    };
    saveWigData(docId, wigData);
}

function handleAddTask(e, wig) {
    e.preventDefault();
    const input = document.getElementById('new-task-desc');
    const description = input.value;
    if (!description.trim()) return;
    const updatedTasks = [...(wig.tasks || []), { id: crypto.randomUUID(), description: description.trim(), completed: false }];
    saveWigData(wig.id, { tasks: updatedTasks });
    input.value = "";
}

function handleToggleTask(taskId, tasks) {
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    const docId = `${selectedDept}-${weekId}`.replace(/[\s&/]/g, '_');
    saveWigData(docId, { tasks: updatedTasks });
}

function handleDeleteTask(taskId, tasks) {
    const updatedTasks = tasks.filter(t => t.id !== taskId);
    const docId = `${selectedDept}-${weekId}`.replace(/[\s&/]/g, '_');
    saveWigData(docId, { tasks: updatedTasks });
}

function handleStatusChange(e, wig) {
    e.preventDefault();
    const newStatus = e.target.dataset.status;
    saveWigData(wig.id, { status: newStatus });
}

function handleAbandonWig(wig) {
    if (!confirm("Are you sure you want to abandon this WIG? This action cannot be undone.")) return;
    saveWigData(wig.id, {
        status: 'abandoned',
        abandonedAt: new Date().toISOString(),
    });
}

// --- Data Subscriptions ---
function subscribeToCurrentWig() {
    dashboardContent.innerHTML = `
        <div class="text-center p-8">
            <div class="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-indigo-500 mx-auto"></div>
            <p class="mt-4">Loading Data...</p>
        </div>`;
    
    const docId = `${selectedDept}-${weekId}`.replace(/[\s&/]/g, '_');
    const wigDocRef = doc(db, 'artifacts', appId, 'public/data/wigs', docId);
    currentWigUnsubscribe = onSnapshot(wigDocRef, (docSnap) => {
        if (docSnap.exists()) {
            renderWigDashboard({ id: docSnap.id, ...docSnap.data() });
        } else {
            renderWigSetup();
        }
    }, (err) => {
        console.error("Current WIG Snapshot Error:", err);
        dashboardContent.innerHTML = `<p class="text-red-500 text-center">Error loading data.</p>`;
    });
}

function subscribeToHistory() {
    viewHistory.innerHTML = `<div class="text-center p-8"><div class="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-indigo-500 mx-auto"></div><p class="mt-4">Loading History...</p></div>`;
    const wigsCollectionRef = collection(db, 'artifacts', appId, 'public/data/wigs');
    const q = query(wigsCollectionRef);
    historyUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const wigsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderHistory(wigsData);
    }, (err) => {
        console.error("History Snapshot Error:", err);
        viewHistory.innerHTML = `<p class="text-red-500 text-center">Error loading history.</p>`;
    });
}

// --- Initialization ---
function init() {
    deptSelect.innerHTML = DEPARTMENTS.map(dept => `<option value="${dept}">${dept}</option>`).join('');
    deptSelect.value = selectedDept;
    footerWeekId.textContent = weekId;

    tabDashboard.addEventListener('click', () => { currentView = 'dashboard'; render(); });
    tabHistory.addEventListener('click', () => { currentView = 'history'; render(); });
    deptSelect.addEventListener('change', (e) => {
        selectedDept = e.target.value;
        render();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'wig-details-modal') {
            modal.classList.remove('is-open');
        }
    });

    render();
}

// --- App Entry Point ---
window.onload = () => {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                try {
                    await signInAnonymously(auth);
                } catch (authError) {
                    console.error("Auth Error:", authError);
                    if (authError.code === 'auth/configuration-not-found') {
                        appContainer.innerHTML = `<div class="p-8 text-center text-red-500 bg-red-50 rounded-lg">
                            <h2 class="font-bold text-lg">Authentication Error</h2>
                            <p class="mt-2">Anonymous sign-in is not enabled for this Firebase project.</p>
                            <p class="mt-1">Please go to your Firebase Console, select your project, go to Authentication > Sign-in method, and enable the "Anonymous" provider.</p>
                        </div>`;
                    } else {
                        appContainer.innerHTML = `<div class="p-8 text-center text-red-500">Could not authenticate. The app cannot start. Check console for details.</div>`;
                    }
                    return; // Stop execution if auth fails
                }
            }
            init();
        });
    } catch(e) {
        console.error("Firebase Init Error:", e);
        appContainer.innerHTML = `<div class="p-8 text-center text-red-500">Failed to initialize application. Check console for details.</div>`;
    }
};
