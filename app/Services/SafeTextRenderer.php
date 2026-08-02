<?php

namespace App\Services;

use Illuminate\Support\HtmlString;

class SafeTextRenderer
{
    public function render(string $content, string $format): HtmlString
    {
        $escaped = e($content);

        if ($format === 'code') {
            return new HtmlString('<pre class="gojet-code"><code>'.$escaped.'</code></pre>');
        }

        if ($format !== 'markdown') {
            return new HtmlString('<div class="whitespace-pre-wrap break-words">'.$escaped.'</div>');
        }

        $blocks = preg_split('/\n{2,}/', $escaped) ?: [];
        $html = collect($blocks)->map(function (string $block): string {
            $block = preg_replace('/^###\s+(.+)$/m', '<h3>$1</h3>', $block);
            $block = preg_replace('/^##\s+(.+)$/m', '<h2>$1</h2>', $block);
            $block = preg_replace('/^#\s+(.+)$/m', '<h1>$1</h1>', $block);
            $block = preg_replace('/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $block);
            $block = preg_replace('/`([^`]+)`/', '<code>$1</code>', $block);
            $block = preg_replace('/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/', '<a href="$2" rel="nofollow noopener noreferrer" target="_blank">$1</a>', $block);
            if (! str_starts_with(ltrim($block), '<h')) {
                $block = '<p>'.nl2br($block).'</p>';
            }

            return $block;
        })->implode("\n");

        return new HtmlString('<div class="gojet-markdown">'.$html.'</div>');
    }
}
