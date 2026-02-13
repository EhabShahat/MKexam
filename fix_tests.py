import re

with open('src/__tests__/integration/adminSummariesAPI.integration.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
new_lines = []
in_second_describe = False
line_num = 0

for line in lines:
    line_num += 1
    
    # Detect second describe block (after line 580)
    if line_num > 580 and "describe('Admin Summaries API" in line:
        in_second_describe = True
    
    # Only replace in second describe block
    if in_second_describe:
        # Replace includeInPass with include_in_pass (with any whitespace and value)
        if 'includeInPass:' in line and 'exam_attempts' not in line:
            line = line.replace('includeInPass:', 'include_in_pass:')
        # Replace passThreshold with pass_threshold
        if 'passThreshold:' in line and 'exam_attempts' not in line:
            line = line.replace('passThreshold:', 'pass_threshold:')
    
    new_lines.append(line)

with open('src/__tests__/integration/adminSummariesAPI.integration.test.ts', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print('Fixed all exam_attempts in second describe block')
