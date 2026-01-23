#!/bin/bash

# 整页公式识别系统 - 快速测试脚本

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   整页公式识别深度优化系统 - 快速验证测试                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
run_test() {
  local test_name=$1
  local test_command=$2
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo -n "[$TOTAL_TESTS] $test_name ... "
  
  if eval "$test_command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 1: 环境检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "Node.js 版本检查 (>=18)" "node -v | grep -E 'v(1[8-9]|[2-9][0-9])'"
run_test "npm 可用性检查" "npm -v"
run_test "依赖安装检查" "test -d node_modules"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 2: 文件结构验证"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 核心文件检查
run_test "types.ts 存在" "test -f src/utils/wholePageRecognition/types.ts"
run_test "interfaces.ts 存在" "test -f src/utils/wholePageRecognition/interfaces.ts"
run_test "errors.ts 存在" "test -f src/utils/wholePageRecognition/errors.ts"
run_test "index.ts 存在" "test -f src/utils/wholePageRecognition/index.ts"

# 核心组件检查
run_test "BatchProcessingManager 存在" "test -f src/utils/wholePageRecognition/BatchProcessingManager.ts"
run_test "BoundaryLocator 存在" "test -f src/utils/wholePageRecognition/BoundaryLocator.ts"
run_test "ConfidenceScorer 存在" "test -f src/utils/wholePageRecognition/ConfidenceScorer.ts"
run_test "DetectionOptimizer 存在" "test -f src/utils/wholePageRecognition/DetectionOptimizer.ts"
run_test "WholePageProcessor 存在" "test -f src/utils/wholePageRecognition/WholePageProcessor.ts"

# 性能优化组件检查
run_test "WorkerPool 存在" "test -f src/utils/wholePageRecognition/WorkerPool.ts"
run_test "ProgressiveRenderer 存在" "test -f src/utils/wholePageRecognition/ProgressiveRenderer.ts"
run_test "LazyImageLoader 存在" "test -f src/utils/wholePageRecognition/LazyImageLoader.ts"
run_test "ResourceManager 存在" "test -f src/utils/wholePageRecognition/ResourceManager.ts"

# UI组件检查
run_test "OptimizedFormulaOverlay 存在" "test -f src/components/wholePageRecognition/OptimizedFormulaOverlay.tsx"
run_test "VirtualScrollContainer 存在" "test -f src/components/wholePageRecognition/VirtualScrollContainer.tsx"
run_test "OptimizedWholePageDetector 存在" "test -f src/components/wholePageRecognition/OptimizedWholePageDetector.tsx"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 3: TypeScript 编译检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "TypeScript 编译" "npm run build"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 4: 代码质量检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_test "ESLint 检查" "npm run lint"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 5: 单元测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if npm run test:run; then
  echo -e "${GREEN}✓ 单元测试通过${NC}"
  PASSED_TESTS=$((PASSED_TESTS + 1))
else
  echo -e "${RED}✗ 单元测试失败${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  测试总结"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"

PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo "通过率: $PASS_RATE%"

echo ""
if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                  🎉 所有测试通过！                         ║${NC}"
  echo -e "${GREEN}║          系统已准备好投入生产使用                          ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║                  ⚠️  部分测试失败                          ║${NC}"
  echo -e "${RED}║            请检查失败的测试并修复问题                       ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
  exit 1
fi
