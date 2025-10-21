
import { Router } from 'express';import { getPool } from './db.js';import { authMiddleware, signToken, verifyUser } from './auth.js';import bcrypt from 'bcryptjs';import { v4 as uuid } from 'uuid';const router=Router();router.get('/health',(req,res)=>res.json({ok:true}));router.post('/auth/register',async(req,res)=>{const pool=getPool();if(!pool)return res.status(500).json({error:'Database not configured'});const {email,password,name,role='client'}=req.body;const hash=await bcrypt.hash(password,10);await pool.query('INSERT INTO users (id,email,name,role,password_hash) VALUES ($1,$2,$3,$4,$5)',[uuid(),email,name,role,hash]);res.json({ok:true})});router.post('/auth/login',async(req,res)=>{const {email,password}=req.body;const user=await verifyUser(email,password);if(!user)return res.status(401).json({error:'Invalid credentials'});const token=signToken(user);res.json({token,user})});router.get('/auth/profile',authMiddleware,async(req,res)=>{res.json({user:req.user})});const mem={projects:[],messages:[],events:[],contracts:[],contacts:[]};async function getAll(table){const pool=getPool();if(!pool)return mem[table];const {rows}=await pool.query(`SELECT * FROM ${table} ORDER BY created_at DESC`);return rows}router.get('/projects',authMiddleware,async(req,res)=>{res.json({projects:await getAll('projects')})});router.post('/projects',authMiddleware,async(req,res)=>{const pool=getPool();const item={id:uuid(),title:req.body.title,status:req.body.status||'Active',owner_id:req.user.id};if(!pool){mem.projects.unshift({...item,created_at:new Date().toISOString()});return res.json({project:item})}await pool.query('INSERT INTO projects(id,title,status,owner_id) VALUES ($1,$2,$3,$4)',[item.id,item.title,item.status,item.owner_id]);res.json({project:item})});router.put('/projects/:id',authMiddleware,async(req,res)=>{const pool=getPool();const {id}=req.params;const {title,status}=req.body;if(!pool){mem.projects=mem.projects.map(p=>p.id===id?{...p,title,status}:p);return res.json({project:{id,title,status}})}await pool.query('UPDATE projects SET title=COALESCE($2,title), status=COALESCE($3,status) WHERE id=$1',[id,title,status]);res.json({project:{id,title,status}})});router.delete('/projects/:id',authMiddleware,async(req,res)=>{const pool=getPool();const {id}=req.params;if(!pool){mem.projects=mem.projects.filter(p=>p.id!==id);return res.json({ok:true})}await pool.query('DELETE FROM projects WHERE id=$1',[id]);res.json({ok:true})});router.get('/messages',authMiddleware,async(req,res)=>{res.json({messages:await getAll('messages')})});router.post('/messages',authMiddleware,async(req,res)=>{const pool=getPool();const msg={id:uuid(),sender_id:req.user.id,sender_name:req.user.email,subject:req.body.subject||'',body:req.body.body||'',read:false};if(!pool){mem.messages.unshift({...msg,created_at:new Date().toISOString()});return res.json({message:msg})}await pool.query('INSERT INTO messages(id,sender_id,sender_name,subject,body,read) VALUES ($1,$2,$3,$4,$5,$6)',[msg.id,msg.sender_id,msg.sender_name,msg.subject,msg.body,false]);res.json({message:msg})});router.put('/messages/:id/read',authMiddleware,async(req,res)=>{const pool=getPool();const {id}=req.params;if(!pool){mem.messages=mem.messages.map(m=>m.id===id?{...m,read:true}:m);return res.json({ok:true})}await pool.query('UPDATE messages SET read=true WHERE id=$1',[id]);res.json({ok:true})});router.get('/calendar',authMiddleware,async(req,res)=>{res.json({events:await getAll('events')})});router.post('/calendar',authMiddleware,async(req,res)=>{const pool=getPool();const ev={id:uuid(),title:req.body.title,date:req.body.date,attendees:JSON.stringify(req.body.attendees||[]),owner_id:req.user.id};if(!pool){mem.events.unshift({...ev,created_at:new Date().toISOString()});return res.json({event:ev})}await pool.query('INSERT INTO events(id,title,date,attendees,owner_id) VALUES ($1,$2,$3,$4,$5)',[ev.id,ev.title,ev.date,ev.attendees,ev.owner_id]);res.json({event:ev})});router.get('/contracts',authMiddleware,async(req,res)=>{res.json({contracts:await getAll('contracts')})});router.post('/contact',async(req,res)=>{const pool=getPool();const c={id:uuid(),name:req.body.name,email:req.body.email,comments:req.body.comments||''};if(!pool){mem.contacts.unshift({...c,created_at:new Date().toISOString()});return res.json({ok:true})}await pool.query('INSERT INTO contact_submissions(id,name,email,comments) VALUES ($1,$2,$3,$4)',[c.id,c.name,c.email,c.comments]);res.json({ok:true})});

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
    await pool.query('INSERT INTO ai_interactions(id, user_id, query, response, created_at) VALUES ($1, $2, $3, $4, $5)', 
      [uuid(), req.user.id, query, response, new Date().toISOString()]);
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
