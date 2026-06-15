import { Router, Request, Response } from 'express';
import { chat, naturalLanguageToSegment, draftMessage, ChatMessage } from '../services/aiAgent';

const router = Router();

// POST /ai/chat - main conversational AI endpoint
router.post('/chat', async (req: Request, res: Response) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    const result = await chat(message, history as ChatMessage[]);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /ai/segment - natural language → segment SQL
router.post('/segment', async (req: Request, res: Response) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'description required' });

  try {
    const result = await naturalLanguageToSegment(description);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /ai/draft - draft marketing message
router.post('/draft', async (req: Request, res: Response) => {
  const { segment_description, channel, campaign_goal } = req.body;
  if (!segment_description || !channel || !campaign_goal) {
    return res.status(400).json({ error: 'segment_description, channel, campaign_goal required' });
  }

  try {
    const result = await draftMessage(segment_description, channel, campaign_goal);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
