const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Tab Saver API is running!' });
});

// Test MongoDB connection
app.post('/test-connection', async (req, res) => {
  const { mongodbUri } = req.body;
  
  console.log('Testing MongoDB connection...');
  
  if (!mongodbUri) {
    return res.status(400).json({ success: false, error: 'MongoDB URI is required' });
  }

  let client;
  try {
    client = new MongoClient(mongodbUri);
    await client.connect();
    await client.db().admin().listDatabases();
    
    console.log('MongoDB connection successful');
    return res.json({ success: true });
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
      createdAt: new Date()
    });
    
    return res.json({ 
      success: true, 
      tabId: result.insertedId 
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
    const dataWithTimestamp = tabsData.map(tab => ({
      ...tab,
      createdAt: new Date()
    }));
    
    const result = await db.collection('tabs').insertMany(dataWithTimestamp);
    
    return res.json({ 
      success: true, 
      insertedCount: result.insertedCount 
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
  const { mongodbUri, date } = req.body;
  
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
    
    const tabs = await db.collection('tabs')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    
    return res.json({ 
      success: true, 
      tabs 
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
      success: true 
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Test the server at: http://localhost:${PORT}`);
});