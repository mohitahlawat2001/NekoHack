const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { JSDOM } = require('jsdom');

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
      'POST /delete-group',
      'POST /web-analysis'
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

// IMPORTANT: Export the app for Vercel
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}