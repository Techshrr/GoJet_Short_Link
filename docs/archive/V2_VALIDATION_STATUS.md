# GoJet V2 Preparation Validation

Generated from commit `6dac1b4ad641a98000757cae932b6f963a71a025` using PHP 8.3.

**Overall: PASS**

| Check | Exit code |
|---|---:|
| Composer dependency resolution | 0 |
| Application key | 0 |
| Pint fix | 0 |
| Pint validation | 0 |
| Clean MySQL migrations | 0 |
| PHPUnit | 0 |
| npm ci | 0 |
| Vite build | 0 |

## composer-update tail
```text
  - Installing symfony/console (v7.4.15): Extracting archive
  - Installing ramsey/collection (2.1.1): Extracting archive
  - Installing brick/math (0.18.0): Extracting archive
  - Installing ramsey/uuid (4.9.3): Extracting archive
  - Installing psr/simple-cache (3.0.0): Extracting archive
  - Installing nunomaduro/termwind (v2.4.0): Extracting archive
  - Installing symfony/translation-contracts (v3.7.1): Extracting archive
  - Installing symfony/translation (v7.4.14): Extracting archive
  - Installing symfony/polyfill-php83 (v1.41.0): Extracting archive
  - Installing psr/clock (1.0.0): Extracting archive
  - Installing symfony/clock (v7.4.8): Extracting archive
  - Installing carbonphp/carbon-doctrine-types (3.2.0): Extracting archive
  - Installing nesbot/carbon (3.13.1): Extracting archive
  - Installing monolog/monolog (3.10.0): Extracting archive
  - Installing league/uri-interfaces (7.8.1): Extracting archive
  - Installing league/uri (7.8.1): Extracting archive
  - Installing league/mime-type-detection (1.17.0): Extracting archive
  - Installing league/flysystem-local (3.31.0): Extracting archive
  - Installing league/flysystem (3.35.2): Extracting archive
  - Installing nette/utils (v4.1.5): Extracting archive
  - Installing nette/schema (v1.3.5): Extracting archive
  - Installing dflydev/dot-access-data (v3.0.3): Extracting archive
  - Installing league/config (v1.2.0): Extracting archive
  - Installing league/commonmark (2.8.3): Extracting archive
  - Installing laravel/serializable-closure (v2.0.15): Extracting archive
  - Installing laravel/prompts (v0.3.21): Extracting archive
  - Installing guzzlehttp/uri-template (v1.0.10): Extracting archive
  - Installing guzzlehttp/promises (2.5.1): Extracting archive
  - Installing psr/http-client (1.0.3): Extracting archive
  - Installing guzzlehttp/guzzle (7.15.2): Extracting archive
  - Installing fruitcake/php-cors (v1.4.0): Extracting archive
  - Installing dragonmantank/cron-expression (v3.6.0): Extracting archive
  - Installing doctrine/inflector (2.1.0): Extracting archive
  - Installing laravel/framework (v13.23.0): Extracting archive
  - Installing laravel/pint (v1.30.2): Extracting archive
  - Installing hamcrest/hamcrest-php (v2.1.1): Extracting archive
  - Installing mockery/mockery (1.6.12): Extracting archive
  - Installing filp/whoops (2.18.4): Extracting archive
  - Installing nunomaduro/collision (v8.9.5): Extracting archive
  - Installing staabm/side-effects-detector (1.0.5): Extracting archive
  - Installing sebastian/version (6.0.0): Extracting archive
  - Installing sebastian/type (6.0.4): Extracting archive
  - Installing sebastian/recursion-context (7.0.1): Extracting archive
  - Installing sebastian/object-reflector (5.0.0): Extracting archive
  - Installing sebastian/object-enumerator (7.0.0): Extracting archive
  - Installing sebastian/global-state (8.0.3): Extracting archive
  - Installing sebastian/exporter (7.0.3): Extracting archive
  - Installing sebastian/environment (8.1.2): Extracting archive
  - Installing sebastian/diff (7.0.0): Extracting archive
  - Installing sebastian/comparator (7.1.8): Extracting archive
  - Installing sebastian/cli-parser (4.2.1): Extracting archive
  - Installing phpunit/php-timer (8.0.0): Extracting archive
  - Installing phpunit/php-text-template (5.0.0): Extracting archive
  - Installing phpunit/php-invoker (6.0.0): Extracting archive
  - Installing phpunit/php-file-iterator (6.0.1): Extracting archive
  - Installing theseer/tokenizer (2.0.1): Extracting archive
  - Installing nikic/php-parser (v5.8.0): Extracting archive
  - Installing sebastian/lines-of-code (4.0.1): Extracting archive
  - Installing sebastian/complexity (5.0.0): Extracting archive
  - Installing phpunit/php-code-coverage (12.5.7): Extracting archive
  - Installing phar-io/version (3.2.1): Extracting archive
  - Installing phar-io/manifest (2.0.4): Extracting archive
  - Installing myclabs/deep-copy (1.13.4): Extracting archive
  - Installing phpunit/phpunit (12.5.33): Extracting archive
Generating optimized autoload files
> Illuminate\Foundation\ComposerScripts::postAutoloadDump
> @php artisan package:discover --ansi

  [37;44m INFO [39;49m Discovering packages.  

  nesbot/carbon [90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m [32;1mDONE[39;22m
  nunomaduro/collision [90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m [32;1mDONE[39;22m
  nunomaduro/termwind [90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m[90m.[39m [32;1mDONE[39;22m

79 packages you are using are looking for funding.
Use the `composer fund` command to find out more!
> @php artisan vendor:publish --tag=laravel-assets --ansi --force

  [37;44m INFO [39;49m No publishable resources for tag [1m[laravel-assets][22m.  

```

## key tail
```text

   INFO  Application key set successfully.  

```

## pint-test tail
```text

  ............................................................................
  ..............

  ──────────────────────────────────────────────────────────────────── Laravel  
    PASS   .......................................................... 90 files  

```

## migrations tail
```text

   INFO  Preparing database.  

  Creating migration table ...................................... 13.68ms DONE

   INFO  Running migrations.  

  2026_08_01_000000_create_gojet_schema ........................ 325.84ms DONE
  2026_08_01_010000_add_trust_and_domain_controls ............... 85.08ms DONE

```

## npm tail
```text

added 99 packages in 2s
```

## build tail
```text

> build
> vite build

[36mvite v7.3.6 [32mbuilding client environment for production...[36m[39m
transforming...
[32m✓[39m 692 modules transformed.
rendering chunks...
computing gzip size...
[2mpublic/build/[22m[32mmanifest.json            [39m[1m[2m  0.33 kB[22m[1m[22m[2m │ gzip:   0.17 kB[22m
[2mpublic/build/[22m[2massets/[22m[35mapp-D2Mm5kNh.css  [39m[1m[2m 69.96 kB[22m[1m[22m[2m │ gzip:  10.09 kB[22m
[2mpublic/build/[22m[2massets/[22m[36mapp-F1hTv-eG.js   [39m[1m[33m634.51 kB[39m[22m[2m │ gzip: 219.26 kB[22m
[33m
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.[39m
[32m✓ built in 3.74s[39m
```
