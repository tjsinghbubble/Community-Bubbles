---
name: Event dates are text with no recurrence engine
description: durable data-model decisions around event date storage and recurring events
---

Event dates/times are stored as plain text strings, and there is **no recurrence engine anywhere** in the codebase — events marked recurring (e.g. weekly) simply go stale once their date passes; nothing rolls them forward.

**Why:** stale weekly events plus one corrupt date row once left the event feeds empty/500ing. Corrupt text values can string-compare as "future" and crash timezone conversion.

**How to apply:** treat any stored date/time string as untrusted — validate real calendar validity at write time and filter at read time. If recurring events "disappear", their stored date is in the past; a scheduled roll-forward job is the real fix (proposed as a follow-up task).
