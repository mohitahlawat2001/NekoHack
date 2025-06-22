const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Root endpoint - THIS IS CRUCIAL FOR VERCEL
app.get('/', (req, res) => {
  res.json({ 
    message: 'Tab Saver API is running!',
    timestamp: '2025-06-22 03:30:01',
    version: '1.0.0',
    author: 'mohitahlawat2001',
    status: 'healthy',
    endpoints: [
      'GET /',
      'GET /health',
      'POST /test-connection',
      'POST /save-tab',
      'POST /save-all-tabs',
      'POST /load-tabs',
      'POST /load-groups',
      'POST /delete-tab',
      'POST /delete-group'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: '2025-06-22 03:30:01',
    user: 'mohitahlawat2001'
  });
});

// Test MongoDB connection
app.post('/test-connection', async (req, res) => {
  const { mongodbUri } = req.body;
  
  if (!mongodbUri) {
    return res.status(400).json({ success: false, error: 'MongoDB URI is required' });
  }

  let client;
  try {
    client = new MongoClient(mongodbUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    await client.connect();
    await client.db().admin().listDatabases();
    
    return res.json({ 
      success: true, 
      message: 'MongoDB connection successful',
      timestamp: '2025-06-22 03:30:01'
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Save a tab
app.post('/save-tab', async (req, res) => {
  const { mongodbUri, tabData } = req.body;
  
  if (!mongodbUri || !tabData) {
    return res.status(400).json({ success: false, error: 'MongoDB URI and tab data are required' });
  }

  let client;
  try {
    client = new MongoClient(mongodbUri);
    await client.connect();
    
    const db = client.db('tabsaver');
    const result = await db.collection('tabs').insertOne({
      ...tabData,
      createdAt: new Date('2025-06-22T03:30:01Z'),
      updatedAt: new Date('2025-06-22T03:30:01Z'),
      serverTimestamp: new Date().toISOString()
    });
    
    return res.json({ 
      success: true, 
      tabId: result.insertedId,
      message: 'Tab saved successfully'
    });
  } catch (error) {
    console.error('Save tab failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Save all tabs
app.post('/save-all-tabs', async (req, res) => {
  const { mongodbUri, tabsData } = req.body;
  
  if (!mongodbUri || !tabsData || !Array.isArray(tabsData)) {
    return res.status(400).json({ success: false, error: 'MongoDB URI and tabs data array are required' });
  }

  let client;
  try {
    client = new MongoClient(mongodbUri);
    await client.connect();
    
    const db = client.db('tabsaver');
    const currentTime = new Date('2025-06-22T03:30:01Z');
    const dataWithTimestamp = tabsData.map(tab => ({
      ...tab,
      createdAt: currentTime,
      updatedAt: currentTime,
      serverTimestamp: new Date().toISOString()
    }));
    
    const result = await db.collection('tabs').insertMany(dataWithTimestamp);
    
    return res.json({ 
      success: true, 
      insertedCount: result.insertedCount,
      message: `${result.insertedCount} tabs saved successfully`
    });
  } catch (error) {
    console.error('Save all tabs failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Load tabs
app.post('/load-tabs', async (req, res) => {
  const { mongodbUri, date, groupName } = req.body;
  
  if (!mongodbUri) {
    return res.status(400).json({ success: false, error: 'MongoDB URI is required' });
  }

  let client;
  try {
    client = new MongoClient(mongodbUri);
    await client.connect();
    
    const db = client.db('tabsaver');
    let query = {};
    
    if (date) {
      query.date = date;
    }
    
    if (groupName) {
      query.groupName = groupName;
    }
    
    const tabs = await db.collection('tabs')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
    
    return res.json({ 
      success: true, 
      tabs,
      count: tabs.length
    });
  } catch (error) {
    console.error('Load tabs failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Load groups
app.post('/load-groups', async (req, res) => {
  const { mongodbUri } = req.body;
  
  if (!mongodbUri) {
    return res.status(400).json({ success: false, error: 'MongoDB URI is required' });
  }

  let client;
  try {
    client = new MongoClient(mongodbUri);
    await client.connect();
    
    const db = client.db('tabsaver');
    const groups = await db.collection('tabs')
      .distinct('groupName');
    
    const filteredGroups = groups.filter(g => g).sort();
    
    return res.json({ 
      success: true, 
      groups: filteredGroups,
      count: filteredGroups.length
    });
  } catch (error) {
    console.error('Load groups failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Delete a tab
app.post('/delete-tab', async (req, res) => {
  const { mongodbUri, tabId } = req.body;
  
  if (!mongodbUri || !tabId) {
    return res.status(400).json({ success: false, error: 'MongoDB URI and tab ID are required' });
  }

  let client;
  try {
    client = new MongoClient(mongodbUri);
    await client.connect();
    
    const db = client.db('tabsaver');
    const result = await db.collection('tabs').deleteOne({ _id: new ObjectId(tabId) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Tab not found' });
    }
    
    return res.json({ 
      success: true,
      message: 'Tab deleted successfully'
    });
  } catch (error) {
    console.error('Delete tab failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Delete a group
app.post('/delete-group', async (req, res) => {
  const { mongodbUri, groupName } = req.body;
  
  if (!mongodbUri || !groupName) {
    return res.status(400).json({ success: false, error: 'MongoDB URI and group name are required' });
  }

  let client;
  try {
    client = new MongoClient(mongodbUri);
    await client.connect();
    
    const db = client.db('tabsaver');
    const result = await db.collection('tabs').deleteMany({ groupName: groupName });
    
    return res.json({ 
      success: true,
      deletedCount: result.deletedCount,
      message: `Group deleted successfully. ${result.deletedCount} tabs removed.`
    });
  } catch (error) {
    console.error('Delete group failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// IMPORTANT: Export the app for Vercel
module.exports = app;