import fs from 'node:fs';
import path from 'node:path';

function readEnv(filePath) {
  const entries = fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const separator = line.indexOf('=');
      return separator > 0 ? [line.slice(0, separator), line.slice(separator + 1)] : null;
    })
    .filter(Boolean);
  return Object.fromEntries(entries);
}

function parseArgs(argv) {
  const options = { limit: Number.POSITIVE_INFINITY, resume: false, model: 'glm-4v-flash', output: 'ocr-results.json', ids: null, cropRoot: null, jsonMode: false, temperature: null, safeBackslash: false, strictPrompt: false };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--limit') options.limit = Number(argv[++index]);
    if (argv[index] === '--resume') options.resume = true;
    if (argv[index] === '--model') options.model = argv[++index];
    if (argv[index] === '--output') options.output = argv[++index];
    if (argv[index] === '--ids') options.ids = new Set(argv[++index].split(',').filter(Boolean));
    if (argv[index] === '--crop-root') options.cropRoot = argv[++index];
    if (argv[index] === '--json-mode') options.jsonMode = true;
    if (argv[index] === '--temperature') options.temperature = Number(argv[++index]);
    if (argv[index] === '--safe-backslash') options.safeBackslash = true;
    if (argv[index] === '--strict-prompt') options.strictPrompt = true;
  }
  return options;
}

function prompt(formulaType, safeBackslash, strictPrompt) {
  const slashRule = safeBackslash
    ? 'latex 字段中禁止使用反斜杠字符。每个 LaTeX 命令前缀必须改用 §，例如 §frac、§Omega、§rangle。'
    : 'JSON 中反斜杠必须正确转义。';
  const transcriptionRule = strictPrompt
    ? '完整转录裁剪内公式本体的每个可见符号，必须保留等号左侧、上下标、求和/积分上下限和全部公式行。忽略右侧圆括号公式编号。latex 中禁止 $、$$、begin{equation}、begin{aligned}、解释文字和公式外正文。'
    : '';
  return `识别图片中的image公式并输出结构化 JSON。\n公式类型提示：${formulaType}。只在图像证据支持时采用该提示。\n仅提取所选区域中的一个公式。${transcriptionRule}

只允许以下 JSON 结构，不要 Markdown 或解释：
{"formulas":[{"latex":"...","uncertainties":[]}],"uncertainties":[]}

latex 必须是纯 LaTeX；无法确认的字符保留为 [unclear] 并写入 uncertainties。只转录可见内容，不推导或补全。看不到公式时 formulas 为空数组。${slashRule}`;
}

function parseProviderContent(content, safeBackslash) {
  const fenced = String(content ?? '').trim().match(/^`{3}(?:json)?\s*([\s\S]*?)\s*`{3}$/i);
  const parsed = JSON.parse(fenced?.[1] ?? content);
  if (!parsed || !Array.isArray(parsed.formulas)) throw new Error('invalid_output_schema');
  const formulas = parsed.formulas.map(formula => ({
    latex: typeof formula?.latex === 'string' ? formula.latex.trim().replaceAll(safeBackslash ? '§' : '\u0000', '\\') : '',
    uncertainties: Array.isArray(formula?.uncertainties) ? formula.uncertainties.filter(value => typeof value === 'string') : [],
  }));
  if (formulas.some(formula => !formula.latex)) throw new Error('invalid_formula');
  return {
    latex: formulas.map(formula => formula.latex).join('\n\n'),
    formulas,
    uncertainties: Array.isArray(parsed.uncertainties) ? parsed.uncertainties.filter(value => typeof value === 'string') : [],
  };
}

async function recognize(sample, fixtureRoot, apiKey, model, jsonMode, temperature, safeBackslash, strictPrompt) {
  const imagePath = path.join(fixtureRoot, sample.cropFile);
  const image = `data:image/png;base64,${fs.readFileSync(imagePath).toString('base64')}`;
  const startedAt = Date.now();
  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        ...(temperature === null ? {} : { temperature }),
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: image } },
          { type: 'text', text: prompt(sample.formulaType, safeBackslash, strictPrompt) },
        ] }],
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        id: sample.id,
        success: false,
        latex: '',
        processingTime: Date.now() - startedAt,
        httpStatus: response.status,
        errorClass: response.status === 429 ? 'rate_limit' : response.status === 401 || response.status === 403 ? 'auth' : 'provider',
        error: body?.error?.message || `HTTP ${response.status}`,
      };
    }
    const content = body?.choices?.[0]?.message?.content;
    try {
      const parsed = parseProviderContent(content, safeBackslash);
      return { id: sample.id, success: true, ...parsed, processingTime: Date.now() - startedAt, httpStatus: response.status };
    } catch (error) {
      return {
        id: sample.id,
        success: false,
        latex: '',
        processingTime: Date.now() - startedAt,
        httpStatus: response.status,
        errorClass: 'invalid_output',
        error: error instanceof Error ? error.message : 'invalid_output',
        rawContent: typeof content === 'string' ? content : '',
      };
    }
  } catch (error) {
    return {
      id: sample.id,
      success: false,
      latex: '',
      processingTime: Date.now() - startedAt,
      errorClass: 'network',
      error: error instanceof Error ? error.message : 'network_error',
    };
  }
}

const options = parseArgs(process.argv.slice(2));
const repositoryRoot = path.resolve(import.meta.dirname, '..');
const fixtureRoot = path.join(import.meta.dirname, 'fixtures', 'real-pdf-v1');
const manifest = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'manifest.json'), 'utf8'));
const outputPath = path.join(fixtureRoot, options.output);
const env = readEnv(path.join(repositoryRoot, 'formula-ocr', '.env'));
const apiKey = env.VITE_ZHIPU_API_KEY;
if (!apiKey) throw new Error('VITE_ZHIPU_API_KEY is not configured in formula-ocr/.env');

const results = options.resume && fs.existsSync(outputPath)
  ? JSON.parse(fs.readFileSync(outputPath, 'utf8'))
  : [];
const completed = new Set(results.map(result => result.id));
const selected = options.ids ? manifest.samples.filter(sample => options.ids.has(sample.id)) : manifest.samples;
const pending = selected.filter(sample => !completed.has(sample.id)).slice(0, options.limit);
const cropRoot = options.cropRoot ? path.resolve(options.cropRoot) : fixtureRoot;

for (const [index, sample] of pending.entries()) {
  const result = await recognize(sample, cropRoot, apiKey, options.model, options.jsonMode, options.temperature, options.safeBackslash, options.strictPrompt);
  results.push(result);
  fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify({
    completed: results.length,
    batchIndex: index + 1,
    batchTotal: pending.length,
    id: result.id,
    model: options.model,
    success: result.success,
    processingTime: result.processingTime,
    errorClass: result.errorClass,
    latex: result.latex,
  }));
  if (result.errorClass === 'auth' || result.errorClass === 'rate_limit') break;
}
