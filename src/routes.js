import { Router } from 'express';
import { getPool } from './db.js';
import { authMiddleware, signToken, verifyUser } from './auth.js';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { sendContactEmail, sendMeetingRequestEmail } from './emailService.js';

const router = Router();

// Health check
router.get('/health', (req, res) => res.json({ ok: true }));

// Debug endpoint to test user lookup
router.get('/debug/users', (req, res) => {
  const pool = getPool();
  if (!pool) {
    res.json({ 
      message: 'Using in-memory users', 
      users: mem.users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role }))
    });
  } else {
    res.json({ message: 'Database configured' });
  }
});

// Authentication routes
router.post('/auth/register', async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ error: 'Database not configured' });
  
  const { email, password, name, role = 'client' } = req.body;
  const hash = await bcrypt.hash(password, 10);
  
  await pool.query(
    'INSERT INTO users (id, email, name, role, password_hash) VALUES ($1, $2, $3, $4, $5)',
    [uuid(), email, name, role, hash]
  );
  
  res.json({ ok: true });
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await verifyUser(email, password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  const token = signToken(user);
  res.json({ token, user });
});

router.get('/auth/profile', authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

// In-memory fallback data with demo users
const mem = {
  users: [
    {
      id: 'admin-user-id',
      email: 'admin@b26.com',
      name: 'Admin User',
      role: 'admin',
      password_hash: '$2a$10$rGYI9XVxjwIgFU/9ahaQCeIGgQNPcCvm2A3enC41TqSG1Utoh8AeS' // Password123!
    },
    {
      id: 'employee-user-id', 
      email: 'alex@b26.com',
      name: 'Alex Smith',
      role: 'employee',
      password_hash: '$2a$10$rGYI9XVxjwIgFU/9ahaQCeIGgQNPcCvm2A3enC41TqSG1Utoh8AeS' // Password123!
    },
    {
      id: 'client-user-id',
      email: 'client@example.com', 
      name: 'John Stevens',
      role: 'client',
      password_hash: '$2a$10$rGYI9XVxjwIgFU/9ahaQCeIGgQNPcCvm2A3enC41TqSG1Utoh8AeS' // Password123!
    }
  ],
  projects: [],
  messages: [],
  events: [],
  contracts: [],
  contacts: []
};

// Helper function to get data from DB or memory
async function getAll(table) {
  const pool = getPool();
  if (!pool) return mem[table];
  
  const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);
  return rows;
}

// Projects routes
router.get('/projects', authMiddleware, async (req, res) => {
  res.json({ projects: await getAll('projects') });
});

router.post('/projects', authMiddleware, async (req, res) => {
  const pool = getPool();
  const { title, status = 'Active', client, deadline, team, tasks, type, progress = 0 } = req.body;
  
  const project = {
    id: uuid(),
    title,
    status,
    owner_id: req.user.id,
    created_at: new Date().toISOString(),
    client,
    deadline,
    team,
    tasks,
    type,
    progress,
    lastUpdate: new Date().toISOString()
  };

  if (!pool) {
    mem.projects.unshift(project);
    return res.json({ project });
  }

  // Store complex data as JSON in metadata field
  const metadata = JSON.stringify({
    client,
    deadline,
    team,
    tasks,
    type,
    progress,
    lastUpdate: project.lastUpdate
  });

  await pool.query(
    'INSERT INTO projects(id, title, status, owner_id, created_at, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
    [project.id, project.title, project.status, project.owner_id, project.created_at, metadata]
  );
  
  res.json({ project });
});

router.put('/projects/:id', authMiddleware, async (req, res) => {
  const pool = getPool();
  const { id } = req.params;
  const { title, status, client, deadline, team, tasks, type, progress } = req.body;

  if (!pool) {
    mem.projects = mem.projects.map(p => p.id === id ? { 
      ...p, 
      title: title || p.title, 
      status: status || p.status,
      client: client || p.client,
      deadline: deadline || p.deadline,
      team: team || p.team,
      tasks: tasks || p.tasks,
      type: type || p.type,
      progress: progress !== undefined ? progress : p.progress,
      lastUpdate: new Date().toISOString()
    } : p);
    const updatedProject = mem.projects.find(p => p.id === id);
    return res.json({ project: updatedProject });
  }

  const metadata = JSON.stringify({
    client,
    deadline,
    team,
    tasks,
    type,
    progress,
    lastUpdate: new Date().toISOString()
  });

  await pool.query(
    'UPDATE projects SET title=COALESCE($2,title), status=COALESCE($3,status), metadata=COALESCE($4,metadata) WHERE id=$1',
    [id, title, status, metadata]
  );
  
  const { rows } = await pool.query('SELECT * FROM projects WHERE id=$1', [id]);
  res.json({ project: rows[0] });
});

router.delete('/projects/:id', authMiddleware, async (req, res) => {
  const pool = getPool();
  const { id } = req.params;

  if (!pool) {
    mem.projects = mem.projects.filter(p => p.id !== id);
    return res.json({ ok: true });
  }

  await pool.query('DELETE FROM projects WHERE id=$1', [id]);
  res.json({ ok: true });
});

// Messages routes
router.get('/messages', authMiddleware, async (req, res) => {
  const { thread_id, group_id } = req.query;
  const userId = req.user.id;
  let messages = await getAll('messages');
  
  // Filter messages for the current user
  messages = messages.filter(msg => 
    msg.sender_id === userId || 
    msg.recipient === userId ||
    msg.recipient_id === userId
  );
  
  // Apply filters if provided
  if (thread_id) {
    messages = messages.filter(msg => msg.thread_id === thread_id);
  }
  
  if (group_id) {
    messages = messages.filter(msg => msg.group_id === group_id);
  }
  
  // Sort by date descending (newest first)
  messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  res.json({ messages });
});

router.get('/messages/groups', authMiddleware, async (req, res) => {
  const pool = getPool();
  const userId = req.user.id;
  
  if (!pool) {
    // In-memory implementation
    const messages = await getAll('messages');
    const userGroups = {};
    
    messages.forEach(msg => {
      if (msg.is_group && msg.group_id && (msg.sender_id === userId || msg.recipient === userId || msg.recipient_id === userId)) {
        if (!userGroups[msg.group_id]) {
          userGroups[msg.group_id] = {
            id: msg.group_id,
            name: msg.group_name || 'Group Chat',
            created_at: msg.created_at,
            members: []
          };
        }
        
        // Add unique members
        const member = msg.sender_id === userId ? msg.recipient || msg.recipient_id : msg.sender_id;
        if (member && !userGroups[msg.group_id].members.includes(member)) {
          userGroups[msg.group_id].members.push(member);
        }
      }
    });
    
    return res.json({ groups: Object.values(userGroups) });
  }
  
  // Database implementation
  const { rows } = await pool.query(`
    SELECT g.id, g.name, g.created_at, array_agg(DISTINCT gm.user_id) as members 
    FROM message_groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE g.id IN (
      SELECT DISTINCT group_id 
      FROM messages 
      WHERE (sender_id = $1 OR recipient_id = $1) AND is_group = true
    )
    GROUP BY g.id, g.name, g.created_at
    ORDER BY g.created_at DESC
  `, [userId]);
  
  res.json({ groups: rows });
});

router.post('/messages', authMiddleware, async (req, res) => {
  const pool = getPool();
  const { subject = '', body = '', recipients = [], is_group = false, group_name = '' } = req.body;
  
  // For individual messages, we create a single message
  // For group messages, we create a message per recipient
  const createMessage = (recipient) => ({
    id: uuid(),
    sender_id: req.user.id,
    sender_name: req.user.name || req.user.email,
    subject,
    body,
    read: false,
    created_at: new Date().toISOString(),
    recipient,
    is_group,
    group_id: is_group ? uuid() : null,
    group_name,
    thread_id: uuid() // Each message starts a new thread
  });

  if (!pool) {
    // Handle group message
    if (is_group && recipients.length > 0) {
      const groupId = uuid();
      const messages = recipients.map(recipient => ({
        ...createMessage(recipient),
        group_id: groupId
      }));
      
      messages.forEach(message => mem.messages.unshift(message));
      return res.json({ message: messages[0], group: { id: groupId, name: group_name, members: recipients } });
    } 
    // Handle individual message
    else {
      const recipient = recipients.length > 0 ? recipients[0] : '';
      const message = createMessage(recipient);
      mem.messages.unshift(message);
      return res.json({ message });
    }
  }

  // With database
  // Handle group message
  if (is_group && recipients.length > 0) {
    const groupId = uuid();
    const threadId = uuid();
    
    // Create a group entry
    await pool.query(
      'INSERT INTO message_groups(id, name, created_by, created_at) VALUES ($1, $2, $3, $4)',
      [groupId, group_name, req.user.id, new Date().toISOString()]
    );
    
    // Add all recipients to the group
    for (const recipient of recipients) {
      await pool.query(
        'INSERT INTO group_members(group_id, user_id, added_at) VALUES ($1, $2, $3)',
        [groupId, recipient, new Date().toISOString()]
      );
    }
    
    // Create message for each recipient
    const messages = [];
    for (const recipient of recipients) {
      const messageId = uuid();
      await pool.query(
        'INSERT INTO messages(id, sender_id, sender_name, recipient_id, subject, body, read, created_at, is_group, group_id, thread_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [messageId, req.user.id, req.user.name || req.user.email, recipient, subject, body, false, new Date().toISOString(), true, groupId, threadId]
      );
      
      messages.push({
        id: messageId,
        sender_id: req.user.id,
        sender_name: req.user.name || req.user.email,
        subject,
        body,
        read: false,
        created_at: new Date().toISOString(),
        recipient,
        is_group: true,
        group_id: groupId,
        group_name,
        thread_id: threadId
      });
    }
    
    return res.json({ message: messages[0], group: { id: groupId, name: group_name, members: recipients } });
  }
  // Handle individual message
  else {
    const recipient = recipients.length > 0 ? recipients[0] : '';
    const messageId = uuid();
    const threadId = uuid();
    
    await pool.query(
      'INSERT INTO messages(id, sender_id, sender_name, recipient_id, subject, body, read, created_at, is_group, thread_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [messageId, req.user.id, req.user.name || req.user.email, recipient, subject, body, false, new Date().toISOString(), false, threadId]
    );
    
    const message = {
      id: messageId,
      sender_id: req.user.id,
      sender_name: req.user.name || req.user.email,
      subject,
      body,
      read: false,
      created_at: new Date().toISOString(),
      recipient,
      is_group: false,
      thread_id: threadId
    };
    
    return res.json({ message });
  }
});

router.put('/messages/:id/read', authMiddleware, async (req, res) => {
  const pool = getPool();
  const { id } = req.params;

  if (!pool) {
    mem.messages = mem.messages.map(m => m.id === id ? { ...m, read: true } : m);
    return res.json({ ok: true });
  }

  await pool.query('UPDATE messages SET read=true WHERE id=$1', [id]);
  res.json({ ok: true });
});

// Reply to a thread
router.post('/messages/:thread_id/reply', authMiddleware, async (req, res) => {
  const pool = getPool();
  const { thread_id } = req.params;
  const { body = '', recipients = [] } = req.body;
  
  // Find the original message to get subject and group info
  let originalMessage;
  if (!pool) {
    originalMessage = mem.messages.find(m => m.thread_id === thread_id);
    if (!originalMessage) {
      return res.status(404).json({ error: 'Thread not found' });
    }
  } else {
    const { rows } = await pool.query('SELECT * FROM messages WHERE thread_id = $1 LIMIT 1', [thread_id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }
    originalMessage = rows[0];
  }
  
  const subject = `Re: ${originalMessage.subject}`;
  const is_group = !!originalMessage.is_group;
  const group_id = originalMessage.group_id || null;
  const group_name = originalMessage.group_name || '';
  
  // For group messages, send to all group members
  // For 1:1 messages, send to the original sender
  const replyRecipients = is_group ? recipients : [originalMessage.sender_id];
  
  // Create the reply message
  if (!pool) {
    const replies = replyRecipients.map(recipient => {
      const message = {
        id: uuid(),
        sender_id: req.user.id,
        sender_name: req.user.name || req.user.email,
        subject,
        body,
        read: false,
        created_at: new Date().toISOString(),
        recipient,
        is_group,
        group_id,
        group_name,
        thread_id
      };
      mem.messages.unshift(message);
      return message;
    });
    
    return res.json({ message: replies[0] });
  } else {
    // Database implementation
    const messages = [];
    
    for (const recipient of replyRecipients) {
      const messageId = uuid();
      await pool.query(
        'INSERT INTO messages(id, sender_id, sender_name, recipient_id, subject, body, read, created_at, is_group, group_id, thread_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [messageId, req.user.id, req.user.name || req.user.email, recipient, subject, body, false, new Date().toISOString(), is_group, group_id, thread_id]
      );
      
      messages.push({
        id: messageId,
        sender_id: req.user.id,
        sender_name: req.user.name || req.user.email,
        subject,
        body,
        read: false,
        created_at: new Date().toISOString(),
        recipient,
        is_group,
        group_id,
        group_name,
        thread_id
      });
    }
    
    return res.json({ message: messages[0] });
  }
});

// Calendar events routes
router.get('/calendar', authMiddleware, async (req, res) => {
  const { month, year, start, end } = req.query;
  let events = await getAll('events');
  
  // Filter events by date range if provided
  if (start && end) {
    events = events.filter(event => {
      const eventDate = new Date(event.date);
      const startDate = new Date(start);
      const endDate = new Date(end);
      return eventDate >= startDate && eventDate <= endDate;
    });
  }
  // Filter events by month/year if provided
  else if (month && year) {
    events = events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.getMonth() + 1 === parseInt(month) && 
             eventDate.getFullYear() === parseInt(year);
    });
  }
  
  res.json({ events });
});

router.get('/calendar/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const pool = getPool();
  
  if (!pool) {
    const event = mem.events.find(e => e.id === id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    return res.json({ event });
  }
  
  const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
  
  res.json({ event: rows[0] });
});

router.post('/calendar', authMiddleware, async (req, res) => {
  const pool = getPool();
  const { 
    title, 
    start_time, // ISO string with date and time
    end_time,   // ISO string with date and time
    all_day = false,
    description = '',
    location = '',
    attendees = [],
    color = '#000000',
    recurring = false,
    recurrence_rule = '',
    reminders = [15] // minutes before event
  } = req.body;
  
  // Extract date from start_time
  const date = start_time.split('T')[0];
  
  const event = {
    id: uuid(),
    title,
    date,
    start_time,
    end_time,
    all_day,
    description,
    owner_id: req.user.id,
    owner_name: req.user.name || req.user.email,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    location,
    attendees,
    color,
    recurring,
    recurrence_rule,
    reminders,
    status: 'confirmed'
  };

  if (!pool) {
    mem.events.unshift(event);
    return res.json({ event });
  }

  const metadata = JSON.stringify({ 
    start_time, 
    end_time, 
    all_day,
    description,
    location,
    color,
    recurring,
    recurrence_rule,
    reminders,
    status: 'confirmed'
  });
  
  await pool.query(
    'INSERT INTO events(id, title, date, attendees, owner_id, owner_name, created_at, updated_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [event.id, event.title, event.date, JSON.stringify(event.attendees), event.owner_id, event.owner_name, event.created_at, event.updated_at, metadata]
  );
  
  res.json({ event });
});

router.put('/calendar/:id', authMiddleware, async (req, res) => {
  const pool = getPool();
  const { id } = req.params;
  const { 
    title, 
    start_time,
    end_time,
    all_day,
    description,
    location,
    attendees,
    color,
    recurring,
    recurrence_rule,
    reminders,
    status
  } = req.body;
  
  // Extract date from start_time if provided
  const date = start_time ? start_time.split('T')[0] : undefined;
  
  if (!pool) {
    const existingEventIndex = mem.events.findIndex(e => e.id === id);
    if (existingEventIndex === -1) return res.status(404).json({ error: 'Event not found' });
    
    const existingEvent = mem.events[existingEventIndex];
    const updatedEvent = {
      ...existingEvent,
      title: title || existingEvent.title,
      date: date || existingEvent.date,
      start_time: start_time || existingEvent.start_time,
      end_time: end_time || existingEvent.end_time,
      all_day: all_day !== undefined ? all_day : existingEvent.all_day,
      description: description !== undefined ? description : existingEvent.description,
      location: location !== undefined ? location : existingEvent.location,
      attendees: attendees || existingEvent.attendees,
      color: color || existingEvent.color,
      recurring: recurring !== undefined ? recurring : existingEvent.recurring,
      recurrence_rule: recurrence_rule !== undefined ? recurrence_rule : existingEvent.recurrence_rule,
      reminders: reminders || existingEvent.reminders,
      status: status || existingEvent.status,
      updated_at: new Date().toISOString()
    };
    
    mem.events[existingEventIndex] = updatedEvent;
    return res.json({ event: updatedEvent });
  }
  
  const { rows: existingRows } = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
  if (existingRows.length === 0) return res.status(404).json({ error: 'Event not found' });
  
  const existingEvent = existingRows[0];
  const existingMetadata = JSON.parse(existingEvent.metadata || '{}');
  
  const updatedMetadata = JSON.stringify({
    start_time: start_time || existingMetadata.start_time,
    end_time: end_time || existingMetadata.end_time,
    all_day: all_day !== undefined ? all_day : existingMetadata.all_day,
    description: description !== undefined ? description : existingMetadata.description,
    location: location !== undefined ? location : existingMetadata.location,
    color: color || existingMetadata.color,
    recurring: recurring !== undefined ? recurring : existingMetadata.recurring,
    recurrence_rule: recurrence_rule !== undefined ? recurrence_rule : existingMetadata.recurrence_rule,
    reminders: reminders || existingMetadata.reminders,
    status: status || existingMetadata.status
  });
  
  const updated_at = new Date().toISOString();
  
  await pool.query(
    'UPDATE events SET title=COALESCE($2,title), date=COALESCE($3,date), attendees=COALESCE($4,attendees), metadata=$5, updated_at=$6 WHERE id=$1',
    [
      id, 
      title, 
      date, 
      attendees ? JSON.stringify(attendees) : null, 
      updatedMetadata,
      updated_at
    ]
  );
  
  const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
  res.json({ event: rows[0] });
});

router.delete('/calendar/:id', authMiddleware, async (req, res) => {
  const pool = getPool();
  const { id } = req.params;
  
  if (!pool) {
    const initialLength = mem.events.length;
    mem.events = mem.events.filter(e => e.id !== id);
    if (mem.events.length === initialLength) {
      return res.status(404).json({ error: 'Event not found' });
    }
    return res.json({ ok: true });
  }
  
  const { rowCount } = await pool.query('DELETE FROM events WHERE id = $1', [id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Event not found' });
  
  res.json({ ok: true });
});

// Calendar sync with external providers
router.post('/calendar/sync/:provider', authMiddleware, async (req, res) => {
  const { provider } = req.params;
  const { authCode } = req.body;
  
  // This would typically involve OAuth flow and API calls to the provider
  // For this example, we'll simulate successful integration
  
  const supportedProviders = ['google', 'outlook', 'apple'];
  if (!supportedProviders.includes(provider)) {
    return res.status(400).json({ error: 'Unsupported calendar provider' });
  }
  
  // In a real implementation, we would:
  // 1. Exchange authCode for tokens
  // 2. Call provider API to fetch events
  // 3. Store/update events in our database
  // 4. Set up webhook for future updates
  
  // Simulate successful integration
  res.json({
    status: 'connected',
    provider,
    message: `Successfully connected to ${provider} calendar`,
    last_sync: new Date().toISOString()
  });
});

// Contracts routes
router.get('/contracts', authMiddleware, async (req, res) => {
  res.json({ contracts: await getAll('contracts') });
});

router.post('/contracts', authMiddleware, async (req, res) => {
  const pool = getPool();
  const { title, status = 'Draft', startDate, endDate, value, client } = req.body;
  
  const contract = {
    id: uuid(),
    title,
    status,
    created_at: new Date().toISOString(),
    startDate,
    endDate,
    value,
    client
  };

  if (!pool) {
    mem.contracts.unshift(contract);
    return res.json({ contract });
  }

  const metadata = JSON.stringify({ startDate, endDate, value, client });
  
  await pool.query(
    'INSERT INTO contracts(id, title, status, created_at, metadata) VALUES ($1, $2, $3, $4, $5)',
    [contract.id, contract.title, contract.status, contract.created_at, metadata]
  );
  
  res.json({ contract });
});

router.put('/contracts/:id', authMiddleware, async (req, res) => {
  const pool = getPool();
  const { id } = req.params;
  const { title, status, startDate, endDate, value, client } = req.body;

  if (!pool) {
    mem.contracts = mem.contracts.map(c => c.id === id ? {
      ...c,
      title: title || c.title,
      status: status || c.status,
      startDate: startDate || c.startDate,
      endDate: endDate || c.endDate,
      value: value || c.value,
      client: client || c.client
    } : c);
    const updatedContract = mem.contracts.find(c => c.id === id);
    return res.json({ contract: updatedContract });
  }

  const metadata = JSON.stringify({ startDate, endDate, value, client });

  await pool.query(
    'UPDATE contracts SET title=COALESCE($2,title), status=COALESCE($3,status), metadata=COALESCE($4,metadata) WHERE id=$1',
    [id, title, status, metadata]
  );

  const { rows } = await pool.query('SELECT * FROM contracts WHERE id=$1', [id]);
  res.json({ contract: rows[0] });
});

router.delete('/contracts/:id', authMiddleware, async (req, res) => {
  const pool = getPool();
  const { id } = req.params;

  if (!pool) {
    mem.contracts = mem.contracts.filter(c => c.id !== id);
    return res.json({ ok: true });
  }

  await pool.query('DELETE FROM contracts WHERE id=$1', [id]);
  res.json({ ok: true });
});

// Tasks routes
router.get('/tasks', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.json({ tasks: [] });

  const { rows } = await pool.query(
    'SELECT * FROM tasks ORDER BY created_at DESC'
  );
  res.json({ tasks: rows });
});

router.post('/tasks', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const { title, description, status = 'pending', priority = 'medium', dueDate, assigneeId, projectId, tags = [] } = req.body;

  const taskId = uuid();

  await pool.query(
    `INSERT INTO tasks(id, title, description, status, priority, due_date, assignee_id, project_id, created_by, tags, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())`,
    [taskId, title, description, status, priority, dueDate, assigneeId, projectId, req.user.id, JSON.stringify(tags)]
  );

  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  res.json({ task: rows[0] });
});

router.put('/tasks/:id', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const { id } = req.params;
  const { title, description, status, priority, dueDate, assigneeId, projectId, tags, completedAt } = req.body;

  await pool.query(
    `UPDATE tasks
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         status = COALESCE($3, status),
         priority = COALESCE($4, priority),
         due_date = COALESCE($5, due_date),
         assignee_id = COALESCE($6, assignee_id),
         project_id = COALESCE($7, project_id),
         tags = COALESCE($8, tags),
         completed_at = COALESCE($9, completed_at),
         updated_at = now()
     WHERE id = $10`,
    [title, description, status, priority, dueDate, assigneeId, projectId, tags ? JSON.stringify(tags) : null, completedAt, id]
  );

  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  res.json({ task: rows[0] });
});

router.delete('/tasks/:id', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const { id } = req.params;
  await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  res.json({ ok: true });
});

// Documents routes
router.get('/documents', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.json({ documents: [] });

  const { rows } = await pool.query(
    'SELECT * FROM documents ORDER BY created_at DESC'
  );
  res.json({ documents: rows });
});

router.post('/documents', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const {
    filename,
    originalFilename,
    fileSize,
    mimeType,
    category = 'general',
    description = '',
    storagePath = '/uploads/' + filename,
    accessLevel = 'private',
    tags = [],
    confidential = false,
    projectId = null
  } = req.body;

  const docId = uuid();

  await pool.query(
    `INSERT INTO documents(id, filename, original_filename, file_size, mime_type, category, description, storage_path, uploaded_by, access_level, tags, confidential, project_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), now())`,
    [docId, filename, originalFilename, fileSize, mimeType, category, description, storagePath, req.user.id, accessLevel, JSON.stringify(tags), confidential, projectId]
  );

  const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [docId]);
  res.json({ document: rows[0] });
});

router.get('/documents/:id', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const { id } = req.params;
  const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json({ document: rows[0] });
});

router.delete('/documents/:id', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const { id } = req.params;
  await pool.query('DELETE FROM documents WHERE id = $1', [id]);
  res.json({ ok: true });
});

// CRM Contacts routes
router.get('/crm/contacts', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.json({ contacts: [] });

  const { rows } = await pool.query(
    'SELECT * FROM crm_contacts ORDER BY created_at DESC'
  );
  res.json({ contacts: rows });
});

router.post('/crm/contacts', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const {
    firstName, lastName, email, phone, company, title,
    industry, source, status = 'active', tags = [], notes = '',
    linkedinUrl = '', website = '', address = ''
  } = req.body;

  const contactId = uuid();

  await pool.query(
    `INSERT INTO crm_contacts(id, first_name, last_name, email, phone, company, title, industry, source, status, tags, notes, linkedin_url, website, address, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now(), now())`,
    [contactId, firstName, lastName, email, phone, company, title, industry, source, status, JSON.stringify(tags), notes, linkedinUrl, website, address, req.user.id]
  );

  const { rows } = await pool.query('SELECT * FROM crm_contacts WHERE id = $1', [contactId]);
  res.json({ contact: rows[0] });
});

router.put('/crm/contacts/:id', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const { id } = req.params;
  const {
    firstName, lastName, email, phone, company, title,
    industry, source, status, tags, notes,
    linkedinUrl, website, address
  } = req.body;

  await pool.query(
    `UPDATE crm_contacts
     SET first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         email = COALESCE($3, email),
         phone = COALESCE($4, phone),
         company = COALESCE($5, company),
         title = COALESCE($6, title),
         industry = COALESCE($7, industry),
         source = COALESCE($8, source),
         status = COALESCE($9, status),
         tags = COALESCE($10, tags),
         notes = COALESCE($11, notes),
         linkedin_url = COALESCE($12, linkedin_url),
         website = COALESCE($13, website),
         address = COALESCE($14, address),
         updated_at = now()
     WHERE id = $15`,
    [firstName, lastName, email, phone, company, title, industry, source, status,
     tags ? JSON.stringify(tags) : null, notes, linkedinUrl, website, address, id]
  );

  const { rows } = await pool.query('SELECT * FROM crm_contacts WHERE id = $1', [id]);
  res.json({ contact: rows[0] });
});

router.delete('/crm/contacts/:id', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const { id } = req.params;
  await pool.query('DELETE FROM crm_contacts WHERE id = $1', [id]);
  res.json({ ok: true });
});

// CRM Interactions routes
router.get('/crm/interactions', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.json({ interactions: [] });

  const { contactId } = req.query;
  let query = 'SELECT * FROM crm_interactions';
  let params = [];

  if (contactId) {
    query += ' WHERE contact_id = $1';
    params.push(contactId);
  }

  query += ' ORDER BY occurred_at DESC';

  const { rows } = await pool.query(query, params);
  res.json({ interactions: rows });
});

router.post('/crm/interactions', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const {
    contactId, type, subject, content, direction = 'outbound',
    emailMessageId = null, calendarEventId = null, projectId = null, metadata = {}
  } = req.body;

  const interactionId = uuid();

  await pool.query(
    `INSERT INTO crm_interactions(id, contact_id, user_id, type, subject, content, direction, email_message_id, calendar_event_id, project_id, metadata, occurred_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())`,
    [interactionId, contactId, req.user.id, type, subject, content, direction, emailMessageId, calendarEventId, projectId, JSON.stringify(metadata)]
  );

  const { rows } = await pool.query('SELECT * FROM crm_interactions WHERE id = $1', [interactionId]);
  res.json({ interaction: rows[0] });
});

// CRM Opportunities routes
router.get('/crm/opportunities', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.json({ opportunities: [] });

  const { contactId } = req.query;
  let query = 'SELECT * FROM crm_opportunities';
  let params = [];

  if (contactId) {
    query += ' WHERE contact_id = $1';
    params.push(contactId);
  }

  query += ' ORDER BY created_at DESC';

  const { rows } = await pool.query(query, params);
  res.json({ opportunities: rows });
});

router.post('/crm/opportunities', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const {
    contactId, title, description = '', value, probability = 50,
    stage = 'prospecting', expectedCloseDate = null, source = '', tags = []
  } = req.body;

  const opportunityId = uuid();

  await pool.query(
    `INSERT INTO crm_opportunities(id, contact_id, title, description, value, probability, stage, expected_close_date, assigned_to, source, tags, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())`,
    [opportunityId, contactId, title, description, value, probability, stage, expectedCloseDate, req.user.id, source, JSON.stringify(tags)]
  );

  const { rows } = await pool.query('SELECT * FROM crm_opportunities WHERE id = $1', [opportunityId]);
  res.json({ opportunity: rows[0] });
});

// Contact submissions
router.post('/contact', async (req, res) => {
  const pool = getPool();
  const { name, email, firm, phone, comments = '' } = req.body;

  const contact = {
    id: uuid(),
    name,
    email,
    firm,
    phone,
    comments,
    created_at: new Date().toISOString()
  };

  try {
    // Save to database
    if (!pool) {
      mem.contacts.unshift(contact);
    } else {
      await pool.query(
        'INSERT INTO contact_submissions(id, name, email, firm, phone, comments, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [contact.id, contact.name, contact.email, contact.firm, contact.phone, contact.comments, contact.created_at]
      );
    }

    // Send email notification
    await sendContactEmail({ name, email, firm, phone, comments });

    res.json({ ok: true, message: 'Contact form submitted and email sent successfully' });
  } catch (error) {
    console.error('Error processing contact submission:', error);
    res.status(500).json({ error: 'Failed to process contact submission' });
  }
});

// Meeting request submissions
router.post('/meeting-request', async (req, res) => {
  const { advisor, advisors, name, email, phone, firm, notes, selectedTimes } = req.body;

  try {
    // Handle both old (advisor) and new (advisors) format
    const finalAdvisors = advisors || (advisor ? [advisor] : []);

    // Send email notification
    await sendMeetingRequestEmail({ advisors: finalAdvisors, name, email, phone, firm, notes, selectedTimes });

    res.json({ ok: true, message: 'Meeting request sent successfully' });
  } catch (error) {
    console.error('Error processing meeting request:', error);
    res.status(500).json({ error: 'Failed to process meeting request' });
  }
});

// AI Assistant endpoints
router.post('/ai/query', authMiddleware, async (req, res) => {
  const { query } = req.body;
  
  // AI Knowledge Base
  const aiKnowledgeBase = {
    'private_equity': {
      'buyout': 'Buyout strategies involve acquiring controlling stakes in mature companies, often using leverage to enhance returns. Key focus areas include operational improvements, strategic repositioning, and financial optimization.',
      'growth_equity': 'Growth equity investments target companies with proven business models seeking capital for expansion. These investments typically involve minority stakes in profitable, growing companies.',
      'venture_capital': 'Venture capital focuses on early-stage companies with high growth potential and scalable business models. Due diligence emphasizes team quality, market size, and competitive positioning.'
    },
    'real_assets': {
      'real_estate': 'Real estate investments provide inflation protection and stable cash flows through property ownership. Key metrics include cap rates, NOI growth, and location fundamentals.',
      'infrastructure': 'Infrastructure investments offer long-term, stable returns through essential service providers. Focus areas include transportation, utilities, and social infrastructure.',
      'natural_resources': 'Natural resource investments include commodities, energy, and materials with inflation hedging properties. ESG considerations are increasingly important.'
    },
    'public_markets': {
      'equity_strategies': 'Public equity strategies range from passive indexing to active factor-based approaches. Alpha generation requires disciplined security selection and risk management.',
      'fixed_income': 'Fixed income strategies provide portfolio stability and income generation across various credit qualities and duration exposures.',
      'hedge_funds': 'Hedge fund strategies employ various techniques to generate alpha and manage downside risk. Due diligence focuses on process consistency and risk controls.'
    },
    'emerging_sectors': {
      'ai': 'AI investments span infrastructure, applications, and enabling technologies across multiple sectors. Key themes include compute power, data management, and application layer innovations.',
      'quantum': 'Quantum computing represents a transformational technology with applications in cryptography, optimization, and scientific computing. Investment timeline remains long-term.',
      'crypto': 'Cryptocurrency and blockchain investments require careful risk assessment and regulatory consideration. Infrastructure plays are often preferred over direct token exposure.'
    }
  };
  
  const queryLower = query.toLowerCase();
  let response = 'I can help you with investment analysis, market insights, and strategic advisory questions across all asset classes.';
  
  // Enhanced AI responses based on knowledge base
  if (queryLower.includes('private equity') || queryLower.includes('buyout')) {
    response = aiKnowledgeBase.private_equity.buyout + ' I can provide detailed analysis on target companies, valuation metrics, and exit strategies.';
  } else if (queryLower.includes('venture capital') || queryLower.includes('vc')) {
    response = aiKnowledgeBase.private_equity.venture_capital + ' I can analyze market trends, due diligence checklists, and portfolio construction strategies.';
  } else if (queryLower.includes('real estate') || queryLower.includes('property')) {
    response = aiKnowledgeBase.real_assets.real_estate + ' I can assist with market analysis, cap rate trends, and portfolio allocation strategies.';
  } else if (queryLower.includes('infrastructure')) {
    response = aiKnowledgeBase.real_assets.infrastructure + ' I can provide insights on regulatory frameworks, ESG considerations, and risk assessment.';
  } else if (queryLower.includes('hedge fund')) {
    response = aiKnowledgeBase.public_markets.hedge_funds + ' I can analyze strategy performance, risk metrics, and manager selection criteria.';
  } else if (queryLower.includes('ai') || queryLower.includes('artificial intelligence')) {
    response = aiKnowledgeBase.emerging_sectors.ai + ' I can provide market sizing, competitive analysis, and investment frameworks for AI opportunities.';
  } else if (queryLower.includes('quantum')) {
    response = aiKnowledgeBase.emerging_sectors.quantum + ' I can analyze the investment landscape, key players, and timeline for commercialization.';
  } else if (queryLower.includes('crypto') || queryLower.includes('blockchain')) {
    response = aiKnowledgeBase.emerging_sectors.crypto + ' I can provide regulatory updates, risk frameworks, and portfolio integration strategies.';
  } else if (queryLower.includes('allocation') || queryLower.includes('portfolio')) {
    response = 'Strategic asset allocation requires balancing risk, return, and correlation across asset classes. I can help optimize portfolio construction based on your investment objectives, time horizon, and risk tolerance.';
  } else if (queryLower.includes('due diligence')) {
    response = 'Due diligence involves comprehensive analysis of investment opportunities including financial, operational, legal, and strategic factors. I can provide customized checklists and analysis frameworks for different asset classes.';
  } else if (queryLower.includes('esg') || queryLower.includes('sustainability')) {
    response = 'ESG integration is becoming critical for long-term value creation. I can help develop ESG frameworks, impact measurement tools, and regulatory compliance strategies.';
  } else if (queryLower.includes('risk') || queryLower.includes('volatility')) {
    response = 'Risk management requires understanding correlation structures, tail risks, and scenario analysis. I can help with stress testing, VaR calculations, and risk budgeting frameworks.';
  } else if (queryLower.includes('performance') || queryLower.includes('returns')) {
    response = 'Performance analysis involves attribution, benchmarking, and risk-adjusted returns. I can help with Sharpe ratios, alpha generation, and performance measurement frameworks.';
  }
  
  // Store the interaction
  const pool = getPool();
  if (pool) {
    await pool.query(
      'INSERT INTO ai_interactions(id, user_id, query, response, created_at) VALUES ($1, $2, $3, $4, $5)', 
      [uuid(), req.user.id, query, response, new Date().toISOString()]
    );
  }
  
  res.json({ response });
});

router.get('/ai/history', authMiddleware, async (req, res) => {
  const pool = getPool();
  if (!pool) {
    return res.json({ history: [] });
  }
  
  const { rows } = await pool.query(
    'SELECT * FROM ai_interactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
    [req.user.id]
  );
  
  res.json({ history: rows });
});

export default router;
