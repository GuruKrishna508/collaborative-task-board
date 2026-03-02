import React, { useState, useEffect, useRef } from 'react';

const API_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

function App() {
  const [tasks, setTasks] = useState([]);
  const [activeUsers, setActiveUsers] = useState(0);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignee: ''
  });
  
  const ws = useRef(null);

  useEffect(() => {
    // Fetch initial tasks
    fetch(`${API_URL}/api/tasks`)
      .then(res => res.json())
      .then(data => setTasks(data))
      .catch(err => console.error('Error fetching tasks:', err));

    // Setup WebSocket
    ws.current = new WebSocket(WS_URL);
    
    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch(data.type) {
        case 'INIT':
          setTasks(data.tasks);
          setActiveUsers(data.activeUsers);
          break;
        case 'USER_COUNT':
          setActiveUsers(data.count);
          break;
        case 'TASK_CREATED':
          setTasks(prev => [...prev, data.task]);
          break;
        case 'TASK_UPDATED':
          setTasks(prev => prev.map(t => t.id === data.task.id ? data.task : t));
          break;
        case 'TASK_DELETED':
          setTasks(prev => prev.filter(t => t.id !== data.taskId));
          break;
      }
    };
    
    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      });
      
      if (response.ok) {
        setNewTask({
          title: '',
          description: '',
          status: 'todo',
          priority: 'medium',
          assignee: ''
        });
        setShowNewTaskForm(false);
      }
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const fetchAISuggestions = async (taskTitle) => {
    try {
      const response = await fetch(`${API_URL}/api/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskTitle })
      });
      const data = await response.json();
      setSuggestions(data.suggestions);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    }
  };

  const getTasksByStatus = (status) => {
    return tasks.filter(task => task.status === status);
  };

  const TaskCard = ({ task }) => (
    <div 
      style={styles.taskCard}
      onClick={() => {
        setSelectedTask(task);
        fetchAISuggestions(task.title);
      }}
    >
      <div style={styles.taskHeader}>
        <h3 style={styles.taskTitle}>{task.title}</h3>
        <span style={{
          ...styles.priorityBadge,
          backgroundColor: task.priority === 'high' ? '#ef4444' : 
                          task.priority === 'medium' ? '#f59e0b' : '#10b981'
        }}>
          {task.priority}
        </span>
      </div>
      <p style={styles.taskDescription}>{task.description}</p>
      <div style={styles.taskFooter}>
        <span style={styles.assignee}>👤 {task.assignee || 'Unassigned'}</span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteTask(task.id);
          }}
          style={styles.deleteBtn}
        >
          🗑️
        </button>
      </div>
    </div>
  );

  const Column = ({ title, status, color }) => (
    <div style={styles.column}>
      <div style={{ ...styles.columnHeader, backgroundColor: color }}>
        <h2 style={styles.columnTitle}>{title}</h2>
        <span style={styles.taskCount}>{getTasksByStatus(status).length}</span>
      </div>
      <div 
        style={styles.columnContent}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const taskId = e.dataTransfer.getData('taskId');
          handleUpdateTaskStatus(taskId, status);
        }}
      >
        {getTasksByStatus(status).map(task => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
          >
            <TaskCard task={task} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.mainTitle}>🚀 Collaborative Task Board</h1>
          <p style={styles.subtitle}>Real-time collaboration with AI-powered suggestions</p>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.userIndicator}>
            <span style={styles.greenDot}>●</span>
            <span style={styles.userCount}>{activeUsers} active user{activeUsers !== 1 ? 's' : ''}</span>
          </div>
          <button 
            onClick={() => setShowNewTaskForm(true)}
            style={styles.newTaskBtn}
          >
            + New Task
          </button>
        </div>
      </header>

      <div style={styles.board}>
        <Column title="📋 To Do" status="todo" color="#6366f1" />
        <Column title="⚡ In Progress" status="in-progress" color="#f59e0b" />
        <Column title="✅ Done" status="done" color="#10b981" />
      </div>

      {/* New Task Modal */}
      {showNewTaskForm && (
        <div style={styles.modal} onClick={() => setShowNewTaskForm(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Create New Task</h2>
            <form onSubmit={handleCreateTask} style={styles.form}>
              <input
                type="text"
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                style={styles.input}
                required
              />
              <textarea
                placeholder="Description"
                value={newTask.description}
                onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                style={{...styles.input, minHeight: '100px', resize: 'vertical'}}
                required
              />
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                style={styles.input}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <input
                type="text"
                placeholder="Assignee name"
                value={newTask.assignee}
                onChange={(e) => setNewTask({...newTask, assignee: e.target.value})}
                style={styles.input}
              />
              <div style={styles.modalButtons}>
                <button type="button" onClick={() => setShowNewTaskForm(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn}>
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details Modal with AI Suggestions */}
      {selectedTask && (
        <div style={styles.modal} onClick={() => setSelectedTask(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>{selectedTask.title}</h2>
            <p style={styles.modalDescription}>{selectedTask.description}</p>
            
            <div style={styles.detailsGrid}>
              <div>
                <strong>Status:</strong> {selectedTask.status}
              </div>
              <div>
                <strong>Priority:</strong> {selectedTask.priority}
              </div>
              <div>
                <strong>Assignee:</strong> {selectedTask.assignee || 'Unassigned'}
              </div>
            </div>

            {suggestions.length > 0 && (
              <div style={styles.suggestionsBox}>
                <h3 style={styles.suggestionsTitle}>🤖 AI Suggestions</h3>
                <ul style={styles.suggestionsList}>
                  {suggestions.map((suggestion, idx) => (
                    <li key={idx} style={styles.suggestionItem}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}

            <button onClick={() => setSelectedTask(null)} style={styles.closeBtn}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  mainTitle: {
    fontSize: '32px',
    color: '#1f2937',
    marginBottom: '5px',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '14px',
  },
  headerRight: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
  },
  userIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    borderRadius: '20px',
  },
  greenDot: {
    color: '#10b981',
    fontSize: '12px',
  },
  userCount: {
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500',
  },
  newTaskBtn: {
    padding: '10px 20px',
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  board: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
  },
  column: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  columnHeader: {
    padding: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  columnTitle: {
    color: 'white',
    fontSize: '18px',
    fontWeight: '600',
  },
  taskCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
  },
  columnContent: {
    padding: '16px',
    minHeight: '500px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  taskCard: {
    backgroundColor: 'white',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  taskHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    marginBottom: '8px',
  },
  taskTitle: {
    fontSize: '16px',
    color: '#1f2937',
    fontWeight: '600',
    flex: 1,
  },
  priorityBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  taskDescription: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '12px',
  },
  taskFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assignee: {
    fontSize: '13px',
    color: '#374151',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    opacity: '0.6',
    transition: 'opacity 0.2s',
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '32px',
    borderRadius: '12px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
  },
  modalTitle: {
    fontSize: '24px',
    color: '#1f2937',
    marginBottom: '16px',
  },
  modalDescription: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '20px',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '20px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  input: {
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  modalButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '10px 20px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  submitBtn: {
    padding: '10px 20px',
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  closeBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    marginTop: '16px',
  },
  suggestionsBox: {
    backgroundColor: '#eff6ff',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  suggestionsTitle: {
    fontSize: '16px',
    color: '#1e40af',
    marginBottom: '12px',
  },
  suggestionsList: {
    listStyle: 'none',
  },
  suggestionItem: {
    padding: '8px 0',
    color: '#374151',
    fontSize: '14px',
    borderBottom: '1px solid #dbeafe',
  },
};

export default App;
