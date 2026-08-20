import 'dotenv/config';
import OpenAI from 'openai';

async function run() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  console.log('===== Gateway test =====');
  console.log('baseURL :', baseURL);
  console.log('model   :', model);
  console.log('apiKey  :', apiKey ? `${apiKey.slice(0, 8)}…(${apiKey.length} chars)` : '(empty)');

  if (!apiKey) {
    console.error('OPENAI_API_KEY is empty — aborting.');
    process.exit(2);
  }

  const client = new OpenAI({ apiKey, baseURL });

  console.log('\n----- Test 1: simple chat completion (non-streaming) -----');
  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Reply concisely.' },
        { role: 'user', content: 'Trả lời bằng tiếng Việt: 1+1 bằng mấy?' }
      ],
      max_tokens: 80,
      temperature: 0
    });
    const choice = res.choices?.[0];
    console.log('status  : 200');
    console.log('finish  :', choice?.finish_reason);
    console.log('content :', choice?.message?.content);
    console.log('usage   :', JSON.stringify(res.usage));
    console.log('model   :', res.model);
  } catch (error) {
    console.log('FAILED');
    printError(error);
  }

  console.log('\n----- Test 2: chat with function calling (tool) -----');
  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. If a tool matches the user query, call it. Otherwise answer in Vietnamese.' },
        { role: 'user', content: 'Thử gọi tool echo với message="hello world".' }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'echo',
            description: 'Echo back the supplied message.',
            parameters: {
              type: 'object',
              properties: { message: { type: 'string' } },
              required: ['message'],
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: 'auto',
      max_tokens: 120
    });
    const choice = res.choices?.[0];
    console.log('status  : 200');
    console.log('finish  :', choice?.finish_reason);
    console.log('content :', choice?.message?.content);
    console.log('tool_calls:', JSON.stringify(choice?.message?.tool_calls));
    console.log('usage   :', JSON.stringify(res.usage));
  } catch (error) {
    console.log('FAILED');
    printError(error);
  }

  console.log('\n----- Test 3: streaming chat completion -----');
  try {
    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Reply in Vietnamese.' },
        { role: 'user', content: 'Kể một câu về thời tiết hôm nay.' }
      ],
      stream: true,
      max_tokens: 80
    });
    let chunks = 0;
    let full = '';
    for await (const chunk of stream) {
      chunks += 1;
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) full += delta;
    }
    console.log('chunks  :', chunks);
    console.log('content :', full || '(empty)');
  } catch (error) {
    console.log('FAILED');
    printError(error);
  }

  console.log('\n===== Done =====');
}

function printError(error: unknown) {
  if (error && typeof error === 'object') {
    const e = error as { status?: number; message?: string; error?: { message?: string; code?: string; type?: string }; code?: string };
    console.log('status  :', e.status ?? 'n/a');
    console.log('message :', e.message);
    console.log('code    :', e.code);
    if (e.error) console.log('body    :', JSON.stringify(e.error));
  } else {
    console.log(String(error));
  }
}

run().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
