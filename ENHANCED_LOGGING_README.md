# Enhanced ORBIT Agent Logging

## 🎯 Problem Solved

The original ORBIT agent ran for 8 minutes with minimal output, making it impossible to understand:
- Where time was being spent
- What tools were being called
- How many tokens were used
- Whether the Claude SDK was hanging

## 🚀 Enhanced Features Added

### 1. **Structured Logging System**
- **Timestamp tracking**: All logs show elapsed time from start
- **Log levels**: DEBUG, INFO, WARN, ERROR with environment control
- **Phase separation**: Clear visual separation of workflow phases
- **Memory monitoring**: Track memory usage throughout execution

### 2. **Performance Monitoring**
- **Timer class**: Tracks duration of all major operations
- **Tool execution timing**: See how long each Supabase call takes
- **Claude SDK timing**: Monitor time spent in AI processing
- **Total workflow timing**: End-to-end performance tracking

### 3. **Token Usage Tracking**
- **Prompt token estimation**: See input token usage
- **Response token estimation**: Track Claude's output tokens
- **Total token counting**: Monitor cost implications
- **Per-message token tracking**: Detailed usage breakdown

### 4. **Tool Execution Logging**
- **Input/output logging**: See exactly what data is passed to tools
- **Success/failure tracking**: Clear indication of tool results
- **Data size reporting**: Monitor payload sizes
- **Error context**: Detailed error information with stack traces

### 5. **Timeout & Hanging Detection**
- **Configurable timeouts**: Set maximum wait time for Claude SDK
- **Activity monitoring**: Detect if Claude stops responding
- **Heartbeat logging**: Regular status updates during long operations
- **Graceful failure handling**: Clean error reporting for timeouts

### 6. **Environment Configuration**
- **Debug mode**: `LOG_LEVEL=DEBUG` for verbose output
- **Timeout control**: `CLAUDE_TIMEOUT_MS=300000` (5 minutes default)
- **Environment validation**: Check all required variables are set
- **Configuration reporting**: See all settings at startup

## 🔧 How to Use

### Basic Usage (same as before)
```bash
npm run agent:run 63f22b07-2e68-4f2a-8c50-081fcbcc0fed
```

### Debug Mode (verbose logging)
```bash
LOG_LEVEL=DEBUG npm run agent:run 63f22b07-2e68-4f2a-8c50-081fcbcc0fed
```

### Custom Timeout (prevent 8-minute hangs)
```bash
CLAUDE_TIMEOUT_MS=120000 npm run agent:run 63f22b07-2e68-4f2a-8c50-081fcbcc0fed
```

### Full Debug Mode
```bash
LOG_LEVEL=DEBUG CLAUDE_TIMEOUT_MS=120000 npm run agent:run 63f22b07-2e68-4f2a-8c50-081fcbcc0fed
```

## 📊 Enhanced Output Examples

### Startup Phase
```
============================================================
APPLICATION STARTUP
============================================================
[000.001s] [INFO] 🔧 Environment Configuration:
[000.002s] [INFO]    - LOG_LEVEL: DEBUG
[000.002s] [INFO]    - CLAUDE_TIMEOUT_MS: 300000
[000.003s] [INFO]    - SUPABASE_URL: https://your-project.supabase.co
[000.003s] [INFO]    - ANTHROPIC_API_KEY: [SET]
[000.004s] [INFO]    - SUPABASE_SERVICE_KEY: [SET]
```

### Tool Execution
```
[002.145s] [DEBUG] 🔧 TOOL: supabase_execute_sql
[002.146s] [DEBUG] 📥 INPUT: {"query":"SELECT COUNT(*) as count FROM orders..."}
[002.456s] [INFO] ⏱️  SQL Execution: 310ms
[002.457s] [DEBUG] 📤 OUTPUT: {"rowCount":"single"}
[002.457s] [DEBUG] ⏱️  Duration: 311ms
```

### Claude Interaction
```
============================================================
CLAUDE SDK INTERACTION
============================================================
[003.123s] [INFO] 📝 Prompt prepared: 2847 chars, ~712 tokens
[003.124s] [INFO] ⏰ Claude SDK timeout set to 300000ms
[003.125s] [DEBUG] ⏰ Started: Claude SDK Query
[005.678s] [INFO] 🤖 CLAUDE [ASSISTANT]
[005.679s] [INFO] 💭 I'll help you process the ORBIT workflow. Let me start by checking for pending orders that need processing...
[005.680s] [INFO] 🎫 Est. tokens: 23
```

### Memory Monitoring
```
[010.234s] [DEBUG] 💾 Memory - RSS: 156MB, Heap: 89MB
[020.456s] [DEBUG] 💓 Claude activity heartbeat 1/30 - last activity: 2341ms ago
```

### Final Summary
```
============================================================
WORKFLOW COMPLETION
============================================================
[180.234s] [INFO] ✅ Claude processing completed successfully
[180.235s] [INFO] 📈 Total messages processed: 47
[180.236s] [INFO] 🎫 Total estimated tokens used: 3421
[180.237s] [INFO] ⏱️  Total Claude time: 177112ms
[180.238s] [INFO] ⏱️  Total workflow time: 180245ms
```

## 🚨 Troubleshooting Guide

### If the agent hangs for 8+ minutes:
1. **Check the timeout logs** - Look for activity heartbeats
2. **Check token usage** - Large prompts can cause delays
3. **Check tool execution** - See if Supabase calls are slow
4. **Use shorter timeout** - Set `CLAUDE_TIMEOUT_MS=120000`

### If you see no tool calls:
1. **Check context preparation** - Look for database connection errors
2. **Check pending orders count** - If 0, no work to do
3. **Check Claude's reasoning** - Debug mode shows AI thinking

### If tools are failing:
1. **Check environment variables** - All credentials set?
2. **Check Supabase connectivity** - Health check results?
3. **Check tool input/output** - Debug logs show exact data

### Performance Issues:
1. **Memory usage** - Watch for memory leaks
2. **SQL query performance** - Check execution times
3. **Network latency** - Tool execution duration
4. **Token usage** - High token counts slow processing

## 🔍 Key Log Messages to Watch For

- `⏰ Claude SDK timeout set to Xms` - Confirms timeout is configured
- `💓 Claude activity heartbeat` - Shows Claude is still working  
- `🎫 Total estimated tokens used` - Monitor API costs
- `⏱️  Total workflow time` - Overall performance metric
- `❌` - Any error messages need immediate attention
- `💥 Workflow crashed` - Critical failures with stack trace

## 📈 Benefits

1. **Faster debugging**: Immediately see where issues occur
2. **Cost monitoring**: Track token usage and API costs  
3. **Performance optimization**: Identify slow operations
4. **Reliability**: Prevent infinite hangs with timeouts
5. **Transparency**: Understand exactly what the AI is doing
6. **Production readiness**: Proper logging for monitoring

## 🎯 Next Steps

The enhanced logging will help you:
1. **Identify the 8-minute delay source** - Is it Claude, Supabase, or network?
2. **Optimize performance** - See which operations are slowest
3. **Monitor costs** - Track token usage patterns
4. **Debug issues** - Get detailed error context
5. **Scale confidently** - Understand system behavior under load