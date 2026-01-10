import React from 'react';

export type FormulaType = 'auto' | 'math' | 'physics' | 'chemistry';

interface FormulaTypeSelectorProps {
  value: FormulaType;
  onChange: (type: FormulaType) => void;
  compact?: boolean;
}

const FORMULA_TYPES: { value: FormulaType; label: string; icon: string; description: string }[] = [
  { value: 'auto', label: '自动', icon: '🔮', description: '自动检测公式类型' },
  { value: 'math', label: '数学', icon: '📐', description: '数学公式 (代数、微积分等)' },
  { value: 'physics', label: '物理', icon: '⚛️', description: '物理公式 (力学、电磁学等)' },
  { value: 'chemistry', label: '化学', icon: '🧪', description: '化学方程式' },
];

export const FormulaTypeSelector: React.FC<FormulaTypeSelectorProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  if (compact) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FormulaType)}
        className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
        title="公式类型"
      >
        {FORMULA_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.icon} {type.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">公式类型</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {FORMULA_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => onChange(type.value)}
            className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
              value === type.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            title={type.description}
          >
            <span className="text-2xl">{type.icon}</span>
            <span className="text-sm font-medium">{type.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        选择公式类型可以提高识别准确率
      </p>
    </div>
  );
};

/**
 * 获取公式类型的提示词
 */
export function getFormulaTypePrompt(type: FormulaType): string {
  switch (type) {
    case 'math':
      return '这是一个数学公式，可能包含代数、微积分、线性代数等内容。';
    case 'physics':
      return '这是一个物理公式，可能包含力学、电磁学、热力学、量子力学等内容。注意物理常量和单位。';
    case 'chemistry':
      return '这是一个化学方程式或化学公式，注意化学符号、下标和反应箭头。';
    default:
      return '';
  }
}

export default FormulaTypeSelector;
