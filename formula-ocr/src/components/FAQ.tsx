import React, { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: '免费用户有什么限制？',
    answer: '免费用户每天可识别10次，每月最多100次。单次最多上传3张图片。支持LaTeX格式导出。',
  },
  {
    question: '付费后权益什么时候生效？',
    answer: '支付成功后，系统会自动确认并立即升级您的账户，权益即时生效。',
  },
  {
    question: '支持哪些支付方式？',
    answer: '目前支持微信支付和支付宝两种支付方式，扫码即可完成支付。',
  },
  {
    question: '付费会员有什么权益？',
    answer: '付费会员每天可识别200次，每月最多5000次。单次最多上传20张图片。支持LaTeX、Markdown、MathML多种格式导出，并享有优先客服支持。',
  },
  {
    question: '识别准确率如何？',
    answer: '我们使用先进的AI模型进行公式识别，对于清晰的公式图片，准确率可达95%以上。建议上传清晰、对比度高的图片以获得最佳效果。',
  },
  {
    question: '支持哪些类型的公式？',
    answer: '支持数学公式、物理公式、化学方程式等。包括分数、根号、积分、求和、矩阵等各种复杂符号。',
  },
  {
    question: '如何联系客服？',
    answer: '您可以通过邮箱 support@formula-ocr.com 联系我们，我们会在24小时内回复。',
  },
  {
    question: '付费后可以退款吗？',
    answer: '由于虚拟服务的特殊性，付费后暂不支持退款。建议您先使用免费额度体验后再决定是否购买。',
  },
];

/**
 * FAQ 常见问题组件
 */
export const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="py-12">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">常见问题</h2>
        <p className="text-gray-500">有疑问？看看这里能否找到答案</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-3">
        {faqData.map((item, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-sm overflow-hidden"
          >
            <button
              onClick={() => toggleItem(index)}
              className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-800">{item.question}</span>
              <span
                className={`text-gray-400 transition-transform ${
                  openIndex === index ? 'rotate-180' : ''
                }`}
              >
                ▼
              </span>
            </button>
            
            {openIndex === index && (
              <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed">
                {item.answer}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 更多帮助 */}
      <div className="mt-8 text-center">
        <p className="text-gray-500 text-sm">
          没有找到答案？
          <a
            href="mailto:support@formula-ocr.com"
            className="text-amber-600 hover:text-amber-700 ml-1"
          >
            联系客服
          </a>
        </p>
      </div>
    </div>
  );
};

export default FAQ;
