import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// In-memory storage
let tasks = [
  {
    id: '1',
    title: 'Design Database Schema',
    description: 'Create ERD and define tables',
    status: 'todo',
    priority: 'high',
    assignee: 'Alice',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Setup CI/CD Pipeline',
    description: 'Configure GitHub Actions',
    status: 'in-progress',
    priority: 'medium',
    assignee: 'Bob',
    createdAt: new Date().toISOString()
  }
];

let activeUsers = new Set();

// Broadcast to all connected clients
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN state
      client.send(JSON.stringify(data));
    }
  });
}

// WebSocket connection
wss.on('connection', (ws) => {
  const userId = uuidv4();
  activeUsers.add(userId);
  
  console.log(`User ${userId} connected. Total users: ${activeUsers.size}`);
  
  // Send initial data
  ws.send(JSON.stringify({
    type: 'INIT',
    tasks,
    userId,
    activeUsers: activeUsers.size
  }));

  broadcast({
    type: 'USER_COUNT',
    count: activeUsers.size
  });

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());
    
    if (data.type === 'TASK_UPDATE') {
      const taskIndex = tasks.findIndex(t => t.id === data.task.id);
      if (taskIndex !== -1) {
        tasks[taskIndex] = { ...tasks[taskIndex], ...data.task };
        broadcast({
          type: 'TASK_UPDATED',
          task: tasks[taskIndex]
        });
      }
    }
  });

  ws.on('close', () => {
    activeUsers.delete(userId);
    console.log(`User ${userId} disconnected. Total users: ${activeUsers.size}`);
    broadcast({
      type: 'USER_COUNT',
      count: activeUsers.size
    });
  });
});

// REST API endpoints
app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const newTask = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  tasks.push(newTask);
  
  broadcast({
    type: 'TASK_CREATED',
    task: newTask
  });
  
  res.status(201).json(newTask);
});

app.put('/api/tasks/:id', (req, res) => {
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  tasks[taskIndex] = { ...tasks[taskIndex], ...req.body };
  
  broadcast({
    type: 'TASK_UPDATED',
    task: tasks[taskIndex]
  });
  
  res.json(tasks[taskIndex]);
});

app.delete('/api/tasks/:id', (req, res) => {
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  tasks.splice(taskIndex, 1);
  
  broadcast({
    type: 'TASK_DELETED',
    taskId: req.params.id
  });
  
  res.status(204).send();
});

// AI suggestion endpoint (mock - replace with real AI API in production)
app.post('/api/suggestions', (req, res) => {
  const { taskTitle } = req.body;
  
  // Mock AI suggestions based on keywords
  const suggestions = [];
  const lowerTitle = taskTitle.toLowerCase();
  
  if (lowerTitle.includes('database') || lowerTitle.includes('db')) {
    suggestions.push('Consider indexing frequently queried columns');
    suggestions.push('Set up automated backups');
    suggestions.push('Document the schema in Confluence/Notion');
  } else if (lowerTitle.includes('api') || lowerTitle.includes('endpoint')) {
    suggestions.push('Implement rate limiting');
    suggestions.push('Add input validation and error handling');
    suggestions.push('Write API documentation (Swagger/OpenAPI)');
  } else if (lowerTitle.includes('test')) {
    suggestions.push('Aim for >80% code coverage');
    suggestions.push('Include edge cases and error scenarios');
    suggestions.push('Set up automated test runs in CI/CD');
  } else {
    suggestions.push('Break down into smaller subtasks');
    suggestions.push('Set clear acceptance criteria');
    suggestions.push('Estimate time and assign priority');
  }
  
  res.json({ suggestions });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
});

