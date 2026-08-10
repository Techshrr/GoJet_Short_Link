package main

import (
	stdhtml "html"
	"html/template"
	"regexp"
	"strings"
)

// renderSharedText deliberately implements a constrained Markdown subset rather
// than trusting arbitrary HTML. User input is escaped first, then only GoJet's
// own markup is emitted. This keeps public text shares safe under a strict CSP.
func renderSharedText(format, content string) template.HTML {
	switch format {
	case "markdown":
		return template.HTML(renderSafeMarkdown(content)) // #nosec G203 -- renderer escapes user input before emitting controlled markup.
	case "code":
		return template.HTML(`<pre class="code"><code>` + stdhtml.EscapeString(content) + `</code></pre>`) // #nosec G203
	default:
		return template.HTML(`<pre class="plain">` + stdhtml.EscapeString(content) + `</pre>`) // #nosec G203
	}
}

var (
	mdLink   = regexp.MustCompile(`\[([^\]]+)\]\((https?://[^\s)]+)\)`)
	mdBold   = regexp.MustCompile(`\*\*([^*]+)\*\*`)
	mdItalic = regexp.MustCompile(`(^|[^*])\*([^*\n]+)\*`)
	mdCode   = regexp.MustCompile("`([^`\\n]+)`")
	mdOL     = regexp.MustCompile(`^[0-9]+\.\s+`)
)

func renderSafeMarkdown(source string) string {
	lines := strings.Split(strings.ReplaceAll(source, "\r\n", "\n"), "\n")
	var out strings.Builder
	inFence, inUL, inOL := false, false, false
	closeLists := func() {
		if inUL {
			out.WriteString("</ul>")
			inUL = false
		}
		if inOL {
			out.WriteString("</ol>")
			inOL = false
		}
	}
	for _, raw := range lines {
		trimmed := strings.TrimSpace(raw)
		if strings.HasPrefix(trimmed, "```") {
			closeLists()
			if !inFence {
				out.WriteString(`<pre class="code"><code>`)
				inFence = true
			} else {
				out.WriteString("</code></pre>")
				inFence = false
			}
			continue
		}
		if inFence {
			out.WriteString(stdhtml.EscapeString(raw))
			out.WriteByte('\n')
			continue
		}
		if trimmed == "" {
			closeLists()
			continue
		}
		if strings.HasPrefix(trimmed, "- ") || strings.HasPrefix(trimmed, "* ") {
			if inOL {
				out.WriteString("</ol>")
				inOL = false
			}
			if !inUL {
				out.WriteString("<ul>")
				inUL = true
			}
			out.WriteString("<li>" + markdownInline(strings.TrimSpace(trimmed[2:])) + "</li>")
			continue
		}
		if mdOL.MatchString(trimmed) {
			if inUL {
				out.WriteString("</ul>")
				inUL = false
			}
			if !inOL {
				out.WriteString("<ol>")
				inOL = true
			}
			out.WriteString("<li>" + markdownInline(mdOL.ReplaceAllString(trimmed, "")) + "</li>")
			continue
		}
		closeLists()
		if strings.HasPrefix(trimmed, "> ") {
			out.WriteString("<blockquote>" + markdownInline(strings.TrimSpace(trimmed[2:])) + "</blockquote>")
			continue
		}
		level := 0
		for level < len(trimmed) && level < 6 && trimmed[level] == '#' {
			level++
		}
		if level > 0 && level < len(trimmed) && trimmed[level] == ' ' {
			out.WriteString("<h" + string(rune('0'+level)) + ">" + markdownInline(strings.TrimSpace(trimmed[level+1:])) + "</h" + string(rune('0'+level)) + ">")
			continue
		}
		out.WriteString("<p>" + markdownInline(trimmed) + "</p>")
	}
	closeLists()
	if inFence {
		out.WriteString("</code></pre>")
	}
	return out.String()
}

func markdownInline(value string) string {
	value = stdhtml.EscapeString(value)
	value = mdLink.ReplaceAllString(value, `<a href="$2" rel="noopener noreferrer nofollow">$1</a>`)
	value = mdCode.ReplaceAllString(value, `<code>$1</code>`)
	value = mdBold.ReplaceAllString(value, `<strong>$1</strong>`)
	value = mdItalic.ReplaceAllString(value, `$1<em>$2</em>`)
	return value
}
