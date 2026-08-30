// API client utilities
// Multi-provider system is in ./providers/
import { parseRecognitionText } from './ocrContract';

/**
 * Extracts LaTeX code from API response
 * @param response - The raw API response text
 * @returns Extracted LaTeX code or original text if no code block found
 */
export function extractLatex(response: string): string {
  const parsed = parseRecognitionText(response);
  if (!parsed.success) return '';
  return normalizeLatex(parsed.latex);
}

/**
 * Normalize LaTeX code for better KaTeX rendering
 */
function normalizeLatex(latex: string): string {
  let result = latex;
  
  // Remove leading/trailing $ or $$
  result = result.replace(/^\$+|\$+$/g, '');
  
  // Replace Unicode math symbols with LaTeX commands
  const unicodeReplacements: [RegExp, string][] = [
    [/·/g, ' \\cdot '],           // middle dot
    [/×/g, ' \\times '],          // multiplication
    [/÷/g, ' \\div '],            // division
    [/±/g, ' \\pm '],             // plus-minus
    [/∓/g, ' \\mp '],             // minus-plus
    [/≤/g, ' \\leq '],            // less than or equal
    [/≥/g, ' \\geq '],            // greater than or equal
    [/≠/g, ' \\neq '],            // not equal
    [/≈/g, ' \\approx '],         // approximately
    [/∞/g, ' \\infty '],          // infinity
    [/∫/g, ' \\int '],            // integral
    [/∬/g, ' \\iint '],           // double integral
    [/∭/g, ' \\iiint '],          // triple integral
    [/∮/g, ' \\oint '],           // contour integral
    [/∑/g, ' \\sum '],            // summation
    [/∏/g, ' \\prod '],           // product
    [/√/g, ' \\sqrt '],           // square root
    [/∂/g, ' \\partial '],        // partial derivative
    [/∇/g, ' \\nabla '],          // nabla/gradient
    [/α/g, ' \\alpha '],          // Greek letters
    [/β/g, ' \\beta '],
    [/γ/g, ' \\gamma '],
    [/δ/g, ' \\delta '],
    [/ε/g, ' \\varepsilon '],
    [/ζ/g, ' \\zeta '],
    [/η/g, ' \\eta '],
    [/θ/g, ' \\theta '],
    [/ι/g, ' \\iota '],
    [/κ/g, ' \\kappa '],
    [/λ/g, ' \\lambda '],
    [/μ/g, ' \\mu '],
    [/ν/g, ' \\nu '],
    [/ξ/g, ' \\xi '],
    [/π/g, ' \\pi '],
    [/ρ/g, ' \\rho '],
    [/σ/g, ' \\sigma '],
    [/τ/g, ' \\tau '],
    [/υ/g, ' \\upsilon '],
    [/φ/g, ' \\varphi '],
    [/χ/g, ' \\chi '],
    [/ψ/g, ' \\psi '],
    [/ω/g, ' \\omega '],
    [/Γ/g, ' \\Gamma '],
    [/Δ/g, ' \\Delta '],
    [/Θ/g, ' \\Theta '],
    [/Λ/g, ' \\Lambda '],
    [/Ξ/g, ' \\Xi '],
    [/Π/g, ' \\Pi '],
    [/Σ/g, ' \\Sigma '],
    [/Φ/g, ' \\Phi '],
    [/Ψ/g, ' \\Psi '],
    [/Ω/g, ' \\Omega '],
    [/→/g, ' \\rightarrow '],     // arrows
    [/←/g, ' \\leftarrow '],
    [/↔/g, ' \\leftrightarrow '],
    [/⇒/g, ' \\Rightarrow '],
    [/⇐/g, ' \\Leftarrow '],
    [/⇔/g, ' \\Leftrightarrow '],
    [/∈/g, ' \\in '],             // set notation
    [/∉/g, ' \\notin '],
    [/⊂/g, ' \\subset '],
    [/⊃/g, ' \\supset '],
    [/⊆/g, ' \\subseteq '],
    [/⊇/g, ' \\supseteq '],
    [/∪/g, ' \\cup '],
    [/∩/g, ' \\cap '],
    [/∅/g, ' \\emptyset '],
    [/∀/g, ' \\forall '],
    [/∃/g, ' \\exists '],
    [/¬/g, ' \\neg '],
    [/∧/g, ' \\land '],
    [/∨/g, ' \\lor '],
    [/⊥/g, ' \\perp '],
    [/∥/g, ' \\parallel '],
    [/°/g, '^{\\circ}'],          // degree symbol
    [/′/g, "'"],                   // prime
    [/″/g, "''"],                  // double prime
  ];
  
  for (const [pattern, replacement] of unicodeReplacements) {
    result = result.replace(pattern, replacement);
  }
  
  // Clean up multiple spaces
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

/**
 * Gets media type from base64 data URL
 * @param base64 - The base64 data URL
 * @returns The media type string
 */
export function getMediaTypeFromBase64(base64: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  if (base64.includes('data:image/png')) return 'image/png';
  if (base64.includes('data:image/webp')) return 'image/webp';
  if (base64.includes('data:image/gif')) return 'image/gif';
  return 'image/jpeg';
}

export type ProviderErrorClass = 'network' | 'quota' | 'timeout' | 'cancelled' | 'invalid_output' | 'provider';

export function classifyProviderError(error: unknown): ProviderErrorClass {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/AbortError|cancel/i.test(message)) return /cancel/i.test(message) ? 'cancelled' : 'timeout';
  if (/timeout|超时/i.test(message)) return 'timeout';
  if (/quota|429|额度/i.test(message)) return 'quota';
  if (/invalid_output|latex|响应格式|Invalid API response/i.test(message)) return 'invalid_output';
  if (/network|fetch|网络|连接/i.test(message)) return 'network';
  return 'provider';
}

// Legacy function - use providers/index.ts recognizeWithProvider instead
export { recognizeWithProvider as recognizeFormula } from './providers';
