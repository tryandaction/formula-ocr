/**
 * 智谱 AI API 代理
 */

const FORMULA_PROMPT = `分析这张包含学术公式的图片（数学、物理、化学或工程公式均可），提取所有公式并转换为 LaTeX 代码。

要求：
1. 只输出 LaTeX 代码，不要解释
2. 使用标准 LaTeX 语法（\\frac, \\int, \\sum, \\partial 等）
3. 化学公式请使用 \\ce{} 或标准下标格式
4. 多个公式用换行分隔
5. 不清楚的部分标记为 [unclear]

输出格式：
\`\`\`latex
公式1
公式2
\`\`\``;

export interface RecognitionResult {
  success: boolean;
  latex?: string;
  error?: string;
}

// 从响应中提取 LaTeX
function extractLatex(content: string): string {
  // 尝试提取 ```latex ... ``` 代码块
  const latexBlockMatch = content.match(/```latex\s*([\s\S]*?)\s*```/);
  if (latexBlockMatch) {
    return latexBlockMatch[1].trim();
  }

  // 尝试提取 ``` ... ``` 代码块
  const codeBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 尝试提取 $...$ 或 $$...$$ 包裹的内容
  const mathMatches = content.match(/\$\$?([\s\S]*?)\$\$?/g);
  if (mathMatches && mathMatches.length > 0) {
    return mathMatches
      .map(m => m.replace(/^\$+|\$+$/g, '').trim())
      .join('\n');
  }

  // 如果没有特殊格式，返回原始内容（去除多余空白）
  return content.trim();
}

// 调用智谱 API
export async function proxyZhipuAPI(
  imageBase64: string,
  apiKey: string
): Promise<RecognitionResult> {
  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4v-flash',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
              },
            },
            {
              type: 'text',
              text: FORMULA_PROMPT,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      const errorMessage = errorData.error?.message || `API error: ${response.status}`;
      return { success: false, error: errorMessage };
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (!data.choices?.[0]?.message?.content) {
      return { success: false, error: 'Invalid API response' };
    }

    const latex = extractLatex(data.choices[0].message.content);
    return { success: true, latex };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
