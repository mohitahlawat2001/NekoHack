const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { JSDOM } = require('jsdom');
const cron = require('node-cron');
const robotsParser = require('robots-parser');
const path = require('path');

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Serve static files from the current directory
app.use(express.static(__dirname));

// Root endpoint - Serve the web application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'popup.html'));
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'NekoHack - AI Scheduled Task Service API',
    timestamp: '2025-06-22 03:30:01',
    version: '2.0.0',
    author: 'mohitahlawat2001',
    status: 'healthy',
    features: [
      'Tab Management',
      'Web Analysis',
      'AI Scheduled Tasks',
      'Robots.txt Validation',
      'Task Automation'
    ],
    endpoints: [
      'GET /',
      'GET /api',
      'GET /health',
      'POST /test-connection',
      'POST /save-tab',
      'POST /save-all-tabs',
      'POST /load-tabs',
      'POST /load-groups',
      'POST /delete-tab',
      'POST /delete-group',
      'POST /web-analysis',
      'POST /check-robots',
      'POST /create-scheduled-task',
      'POST /load-scheduled-tasks',
      'POST /update-scheduled-task',
      'POST /delete-scheduled-task',
      'POST /pause-scheduled-task',
      'POST /resume-scheduled-task',
      'POST /load-task-results'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: '2025-06-22 03:30:01',
    user: 'mohitahlawat2001',
    scheduledTasks: Object.keys(scheduledTasks).length
  });
});

// Store for scheduled tasks
const scheduledTasks = {};

// Helper function to validate cron expression
function isValidCronExpression(cronExpression) {
  try {
    return cron.validate(cronExpression);
  } catch (error) {
    return false;
  }
}

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

// Check robots.txt endpoint
app.post('/check-robots', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  try {
    const validatedUrl = validateUrl(url);
    if (!validatedUrl) {
      return res.status(400).json({ success: false, error: 'Invalid URL provided' });
    }

    const isAllowed = await checkRobotsPermission(validatedUrl);
    
    return res.json({
      success: true,
      url: validatedUrl,
      scrapingAllowed: isAllowed.allowed,
      robotsUrl: isAllowed.robotsUrl,
      message: isAllowed.message
    });
    
  } catch (error) {
    console.error('Robots.txt check failed:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Web Analysis endpoint
app.post('/web-analysis', async (req, res) => {
  const { url, query, geminiApiKey } = req.body;
  
  if (!url || !query) {
    return res.status(400).json({ success: false, error: 'URL and query are required' });
  }

  if (!geminiApiKey) {
    return res.status(400).json({ success: false, error: 'Gemini API key is required' });
  }

  try {
    // Step 1: Validate URL
    const validatedUrl = validateUrl(url);
    if (!validatedUrl) {
      return res.status(400).json({ success: false, error: 'Invalid URL provided' });
    }

    // Step 2: Fetch web page content
    const html = await fetchWebPage(validatedUrl);
    
    // Step 3: Extract content from HTML
    const extractedContent = await extractContent(html, validatedUrl);
    
    // Step 4: Analyze content with Gemini AI
    const analysis = await analyzeContentWithGemini(extractedContent, query, geminiApiKey);
    
    return res.json({
      success: true,
      url: validatedUrl,
      query,
      pageInfo: {
        title: extractedContent.title,
        siteName: extractedContent.siteName
      },
      analysis: analysis.analysis,
      timestamp: analysis.timestamp
    });
    
  } catch (error) {
    console.error('Web analysis failed:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Create scheduled task endpoint
app.post('/create-scheduled-task', async (req, res) => {
  const { mongodbUri, taskData } = req.body;
  
  if (!mongodbUri || !taskData) {
    return res.status(400).json({ success: false, error: 'MongoDB URI and task data are required' });
  }

  const { url, taskDescription, cronExpression, geminiApiKey } = taskData;
  
  if (!url || !taskDescription || !cronExpression || !geminiApiKey) {
    return res.status(400).json({ 
      success: false, 
      error: 'URL, task description, cron expression, and Gemini API key are required' 
    });
  }

  if (!isValidCronExpression(cronExpression)) {
    return res.status(400).json({ success: false, error: 'Invalid cron expression' });
  }

  let client;
  try {
    // First check if the site allows scraping
    const robotsCheck = await checkRobotsPermission(url);
    if (!robotsCheck.allowed) {
      return res.status(400).json({ 
        success: false, 
        error: `Scraping not allowed for this site: ${robotsCheck.message}` 
      });
    }

    client = new MongoClient(mongodbUri);
    await client.connect();
    
    const db = client.db('tabsaver');
    const task = {
      ...taskData,
      status: 'active',
      createdAt: new Date('2025-06-22T03:30:01Z'),
      updatedAt: new Date('2025-06-22T03:30:01Z'),
      lastExecuted: null,
      nextExecution: getNextExecutionTime(cronExpression),
      executionCount: 0,
      successCount: 0,
      errorCount: 0
    };
    
    const result = await db.collection('scheduled_tasks').insertOne(task);
    
    // Start the cron job
    startScheduledTask(result.insertedId.toString(), task);
    
    return res.json({ 
      success: true, 
      taskId: result.insertedId,
      message: 'Scheduled task created successfully',
      nextExecution: task.nextExecution
    });
  } catch (error) {
    console.error('Create scheduled task failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Load scheduled tasks endpoint
app.post('/load-scheduled-tasks', async (req, res) => {
  const { mongodbUri } = req.body;
  
  if (!mongodbUri) {
    return res.status(400).json({ success: false, error: 'MongoDB URI is required' });
  }

  let client;
  try {
    client = new MongoClient(mongodbUri);
    await client.connect();
    
    const db = client.db('tabsaver');
    const tasks = await db.collection('scheduled_tasks')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    return res.json({ 
      success: true, 
      tasks,
      count: tasks.length
    });
  } catch (error) {
    console.error('Load scheduled tasks failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Delete scheduled task endpoint
app.post('/delete-scheduled-task', async (req, res) => {
  const { mongodbUri, taskId } = req.body;
  
  if (!mongodbUri || !taskId) {
    return res.status(400).json({ success: false, error: 'MongoDB URI and task ID are required' });
  }

  let client;
  try {
    client = new MongoClient(mongodbUri);
    await client.connect();
    
    const db = client.db('tabsaver');
    const result = await db.collection('scheduled_tasks').deleteOne({ _id: new ObjectId(taskId) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    // Stop the cron job
    if (scheduledTasks[taskId]) {
      scheduledTasks[taskId].destroy();
      delete scheduledTasks[taskId];
    }
    
    // Also delete related task results
    await db.collection('task_results').deleteMany({ taskId: new ObjectId(taskId) });
    
    return res.json({ 
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Delete scheduled task failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Pause scheduled task endpoint
app.post('/pause-scheduled-task', async (req, res) => {
  const { mongodbUri, taskId } = req.body;
  
  if (!mongodbUri || !taskId) {
    return res.status(400).json({ success: false, error: 'MongoDB URI and task ID are required' });
  }

  let client;
  try {
    client = new MongoClient(mongodbUri);
    await client.connect();
    
    const db = client.db('tabsaver');
    const result = await db.collection('scheduled_tasks').updateOne(
      { _id: new ObjectId(taskId) },
      { 
        $set: { 
          status: 'paused', 
          updatedAt: new Date('2025-06-22T03:30:01Z') 
        } 
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    // Stop the cron job
    if (scheduledTasks[taskId]) {
      scheduledTasks[taskId].destroy();
      delete scheduledTasks[taskId];
    }
    
    return res.json({ 
      success: true,
      message: 'Task paused successfully'
    });
  } catch (error) {
    console.error('Pause scheduled task failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Resume scheduled task endpoint
app.post('/resume-scheduled-task', async (req, res) => {
  const { mongodbUri, taskId } = req.body;
  
  if (!mongodbUri || !taskId) {
    return res.status(400).json({ success: false, error: 'MongoDB URI and task ID are required' });
  }

  let client;
  try {
    client = new MongoClient(mongodbUri);
    await client.connect();
    
    const db = client.db('tabsaver');
    const task = await db.collection('scheduled_tasks').findOne({ _id: new ObjectId(taskId) });
    
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    const result = await db.collection('scheduled_tasks').updateOne(
      { _id: new ObjectId(taskId) },
      { 
        $set: { 
          status: 'active', 
          updatedAt: new Date('2025-06-22T03:30:01Z'),
          nextExecution: getNextExecutionTime(task.cronExpression)
        } 
      }
    );
    
    // Restart the cron job
    const updatedTask = await db.collection('scheduled_tasks').findOne({ _id: new ObjectId(taskId) });
    if (updatedTask) {
      startScheduledTask(taskId, updatedTask);
    }
    
    return res.json({ 
      success: true,
      message: 'Task resumed successfully'
    });
  } catch (error) {
    console.error('Resume scheduled task failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Load task results endpoint
app.post('/load-task-results', async (req, res) => {
  const { mongodbUri, taskId, limit = 50 } = req.body;
  
  if (!mongodbUri) {
    return res.status(400).json({ success: false, error: 'MongoDB URI is required' });
  }

  let client;
  try {
    client = new MongoClient(mongodbUri);
    await client.connect();
    
    const db = client.db('tabsaver');
    let query = {};
    
    if (taskId) {
      query.taskId = new ObjectId(taskId);
    }
    
    const results = await db.collection('task_results')
      .find(query)
      .sort({ executedAt: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    return res.json({ 
      success: true, 
      results,
      count: results.length
    });
  } catch (error) {
    console.error('Load task results failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Helper functions for web analysis
function validateUrl(url) {
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }
    return url;
  } catch (error) {
    return null;
  }
}

async function fetchWebPage(url) {
  try {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
    ];

    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000,
      maxRedirects: 5
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch page: Status ${response.status}`);
    }

    return response.data;
  } catch (error) {
    console.error(`Error fetching webpage ${url}:`, error.message);
    throw new Error(`Failed to fetch webpage: ${error.message}`);
  }
}

async function extractContent(html, url) {
  try {
    // Use basic extraction with cheerio
    const $ = cheerio.load(html);
    
    // Remove scripts, styles, and other non-content elements
    $('script, style, noscript, iframe, img, svg, canvas, [style*="display:none"]').remove();
    
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    
    // Get main content (prioritize main content areas)
    let content = '';
    ['main', 'article', '#content', '.content', '#main', '.main'].forEach(selector => {
      if (content.length < 1000 && $(selector).length) {
        content += $(selector).text().trim() + ' ';
      }
    });
    
    // If still no substantial content, get body text
    if (content.length < 500) {
      content = $('body').text().trim();
    }
    
    // Clean up the content (remove excessive whitespace)
    content = content.replace(/\s+/g, ' ').trim();
    
    return {
      title,
      content,
      excerpt: metaDescription,
      siteName: extractSiteName(url),
      contentType: 'general'
    };
  } catch (error) {
    console.error(`Error extracting content from webpage:`, error.message);
    throw new Error(`Failed to extract content: ${error.message}`);
  }
}

function extractSiteName(url) {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function analyzeContentWithGemini(content, userQuery, apiKey) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Truncate content if too long
    const truncatedContent = truncateContent(content.content);
    
    const prompt = constructPrompt(content, userQuery, truncatedContent);
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });

    const responseText = result.response.text();
    
    return {
      analysis: responseText,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

function constructPrompt(content, userQuery, truncatedContent) {
  return `
Task: Analyze web content and answer a specific question.

Web Page Information:
Title: ${content.title}
Website: ${content.siteName}
Content: ${truncatedContent}

User Question: ${userQuery}

Instructions:
1. Focus only on information present in the provided content
2. If the content doesn't contain information to answer the question, state that clearly
3. Provide specific references to parts of the content that support your answer
4. Keep your answer concise, accurate, and directly relevant to the question
5. Do not make assumptions about content not included in the excerpt
6. Format your answer in a clear, readable manner

Your analysis:
`;
}

function truncateContent(content) {
  // Keep content under ~8,000 characters to leave room for the rest of the prompt
  const maxLength = 8000;
  if (content.length <= maxLength) return content;
  
  // Take the first and last parts to preserve context
  const firstPart = content.substring(0, maxLength / 2);
  const lastPart = content.substring(content.length - maxLength / 2);
  
  return `${firstPart}\n\n[...Content truncated due to length...]\n\n${lastPart}`;
}

// Helper functions for scheduled tasks
async function checkRobotsPermission(url) {
  try {
    const urlObj = new URL(url);
    const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
    
    const response = await axios.get(robotsUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'NekoHack-Scheduler/1.0.0'
      }
    });
    
    const robots = robotsParser(robotsUrl, response.data);
    const isAllowed = robots.isAllowed(url, 'NekoHack-Scheduler');
    
    return {
      allowed: isAllowed,
      robotsUrl: robotsUrl,
      message: isAllowed ? 'Scraping allowed by robots.txt' : 'Scraping disallowed by robots.txt'
    };
  } catch (error) {
    // If robots.txt doesn't exist or is inaccessible, assume scraping is allowed
    console.log(`Robots.txt check failed for ${url}:`, error.message);
    return {
      allowed: true,
      robotsUrl: null,
      message: 'No robots.txt found - scraping allowed by default'
    };
  }
}

function getNextExecutionTime(cronExpression) {
  try {
    const task = cron.schedule(cronExpression, () => {}, { scheduled: false });
    const next = task.nextDates(1);
    task.destroy();
    return next[0] ? next[0].toDate() : null;
  } catch (error) {
    return null;
  }
}

function startScheduledTask(taskId, task) {
  try {
    if (scheduledTasks[taskId]) {
      scheduledTasks[taskId].destroy();
    }
    
    const cronJob = cron.schedule(task.cronExpression, async () => {
      await executeScheduledTask(taskId, task);
    }, {
      scheduled: true,
      timezone: 'UTC'
    });
    
    scheduledTasks[taskId] = cronJob;
    console.log(`Started scheduled task ${taskId} with cron: ${task.cronExpression}`);
  } catch (error) {
    console.error(`Failed to start scheduled task ${taskId}:`, error);
  }
}

async function executeScheduledTask(taskId, task) {
  let client;
  try {
    console.log(`Executing scheduled task ${taskId} for URL: ${task.url}`);
    
    // Connect to MongoDB
    client = new MongoClient(task.mongodbUri || process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('tabsaver');
    
    // Update task execution stats
    await db.collection('scheduled_tasks').updateOne(
      { _id: new ObjectId(taskId) },
      { 
        $set: { 
          lastExecuted: new Date(),
          nextExecution: getNextExecutionTime(task.cronExpression)
        },
        $inc: { executionCount: 1 }
      }
    );
    
    // Check robots.txt permission (for safety)
    const robotsCheck = await checkRobotsPermission(task.url);
    if (!robotsCheck.allowed) {
      throw new Error(`Scraping no longer allowed for ${task.url}: ${robotsCheck.message}`);
    }
    
    // Fetch and analyze webpage
    const html = await fetchWebPage(task.url);
    const extractedContent = await extractContent(html, task.url);
    const analysis = await analyzeContentWithGemini(extractedContent, task.taskDescription, task.geminiApiKey);
    
    // Save execution result
    const executionResult = {
      taskId: new ObjectId(taskId),
      url: task.url,
      taskDescription: task.taskDescription,
      executedAt: new Date(),
      status: 'success',
      result: {
        analysis: analysis.analysis,
        pageInfo: {
          title: extractedContent.title,
          siteName: extractedContent.siteName
        },
        timestamp: analysis.timestamp
      },
      executionTime: new Date() - new Date()
    };
    
    await db.collection('task_results').insertOne(executionResult);
    
    // Update success count
    await db.collection('scheduled_tasks').updateOne(
      { _id: new ObjectId(taskId) },
      { $inc: { successCount: 1 } }
    );
    
    console.log(`Successfully executed scheduled task ${taskId}`);
    
  } catch (error) {
    console.error(`Failed to execute scheduled task ${taskId}:`, error);
    
    // Save error result
    if (client) {
      try {
        const db = client.db('tabsaver');
        const errorResult = {
          taskId: new ObjectId(taskId),
          url: task.url,
          taskDescription: task.taskDescription,
          executedAt: new Date(),
          status: 'error',
          error: error.message,
          executionTime: new Date() - new Date()
        };
        
        await db.collection('task_results').insertOne(errorResult);
        
        // Update error count
        await db.collection('scheduled_tasks').updateOne(
          { _id: new ObjectId(taskId) },
          { $inc: { errorCount: 1 } }
        );
      } catch (dbError) {
        console.error(`Failed to save error result for task ${taskId}:`, dbError);
      }
    }
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Load and start existing active scheduled tasks on server startup
async function loadAndStartScheduledTasks() {
  // This would be called when the server starts to resume existing tasks
  // For now, we'll implement this as a simple function that can be called
  console.log('Server started - scheduled tasks can be loaded via API calls');
}

// IMPORTANT: Export the app for Vercel
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}