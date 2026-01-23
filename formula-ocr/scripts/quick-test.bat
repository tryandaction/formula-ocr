@echo off
setlocal enabledelayedexpansion

REM 整页公式识别系统 - 快速测试脚本 (Windows)

echo ================================================================
echo    整页公式识别深度优化系统 - 快速验证测试
echo ================================================================
echo.

set TOTAL_TESTS=0
set PASSED_TESTS=0
set FAILED_TESTS=0

REM 测试函数
:run_test
set /a TOTAL_TESTS+=1
echo [%TOTAL_TESTS%] %~1 ...
%~2 >nul 2>&1
if %errorlevel% equ 0 (
  echo [32m✓ PASS[0m
  set /a PASSED_TESTS+=1
) else (
  echo [31m✗ FAIL[0m
  set /a FAILED_TESTS+=1
)
goto :eof

echo ================================================================
echo   Phase 1: 环境检查
echo ================================================================

call :run_test "Node.js 可用性检查" "node -v"
call :run_test "npm 可用性检查" "npm -v"
call :run_test "依赖安装检查" "dir node_modules"

echo.
echo ================================================================
echo   Phase 2: 文件结构验证
echo ================================================================

REM 核心文件检查
call :run_test "types.ts 存在" "dir src\utils\wholePageRecognition\types.ts"
call :run_test "interfaces.ts 存在" "dir src\utils\wholePageRecognition\interfaces.ts"
call :run_test "errors.ts 存在" "dir src\utils\wholePageRecognition\errors.ts"
call :run_test "index.ts 存在" "dir src\utils\wholePageRecognition\index.ts"

REM 核心组件检查
call :run_test "BatchProcessingManager 存在" "dir src\utils\wholePageRecognition\BatchProcessingManager.ts"
call :run_test "BoundaryLocator 存在" "dir src\utils\wholePageRecognition\BoundaryLocator.ts"
call :run_test "ConfidenceScorer 存在" "dir src\utils\wholePageRecognition\ConfidenceScorer.ts"
call :run_test "DetectionOptimizer 存在" "dir src\utils\wholePageRecognition\DetectionOptimizer.ts"
call :run_test "WholePageProcessor 存在" "dir src\utils\wholePageRecognition\WholePageProcessor.ts"

REM 性能优化组件检查
call :run_test "WorkerPool 存在" "dir src\utils\wholePageRecognition\WorkerPool.ts"
call :run_test "ProgressiveRenderer 存在" "dir src\utils\wholePageRecognition\ProgressiveRenderer.ts"
call :run_test "LazyImageLoader 存在" "dir src\utils\wholePageRecognition\LazyImageLoader.ts"
call :run_test "ResourceManager 存在" "dir src\utils\wholePageRecognition\ResourceManager.ts"

REM UI组件检查
call :run_test "OptimizedFormulaOverlay 存在" "dir src\components\wholePageRecognition\OptimizedFormulaOverlay.tsx"
call :run_test "VirtualScrollContainer 存在" "dir src\components\wholePageRecognition\VirtualScrollContainer.tsx"
call :run_test "OptimizedWholePageDetector 存在" "dir src\components\wholePageRecognition\OptimizedWholePageDetector.tsx"

echo.
echo ================================================================
echo   Phase 3: TypeScript 编译检查
echo ================================================================

set /a TOTAL_TESTS+=1
echo [%TOTAL_TESTS%] TypeScript 编译 ...
call npm run build
if %errorlevel% equ 0 (
  echo [32m✓ PASS[0m
  set /a PASSED_TESTS+=1
) else (
  echo [31m✗ FAIL[0m
  set /a FAILED_TESTS+=1
)

echo.
echo ================================================================
echo   Phase 4: 代码质量检查
echo ================================================================

set /a TOTAL_TESTS+=1
echo [%TOTAL_TESTS%] ESLint 检查 ...
call npm run lint
if %errorlevel% equ 0 (
  echo [32m✓ PASS[0m
  set /a PASSED_TESTS+=1
) else (
  echo [31m✗ FAIL[0m
  set /a FAILED_TESTS+=1
)

echo.
echo ================================================================
echo   Phase 5: 单元测试
echo ================================================================

set /a TOTAL_TESTS+=1
echo [%TOTAL_TESTS%] 单元测试 ...
call npm run test:run
if %errorlevel% equ 0 (
  echo [32m✓ PASS[0m
  set /a PASSED_TESTS+=1
) else (
  echo [31m✗ FAIL[0m
  set /a FAILED_TESTS+=1
)

echo.
echo ================================================================
echo   测试总结
echo ================================================================
echo.

echo 总测试数: %TOTAL_TESTS%
echo 通过: %PASSED_TESTS%
echo 失败: %FAILED_TESTS%

set /a PASS_RATE=PASSED_TESTS*100/TOTAL_TESTS
echo 通过率: %PASS_RATE%%%

echo.
if %FAILED_TESTS% equ 0 (
  echo ================================================================
  echo                   🎉 所有测试通过！
  echo           系统已准备好投入生产使用
  echo ================================================================
  exit /b 0
) else (
  echo ================================================================
  echo                   ⚠️  部分测试失败
  echo             请检查失败的测试并修复问题
  echo ================================================================
  exit /b 1
)
