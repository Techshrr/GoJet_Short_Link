# GoJet V2 PHPUnit Status

Generated from commit `6dac1b4ad641a98000757cae932b6f963a71a025`. Exit code: 0.

```text

  [30;42;1m PASS [39;49;22m[39m Tests\Unit\UrlSafetyServiceTest[39m
  [32;1m✓[39;22m[90m [39m[90mit accepts public https urls[39m[90m                                        [39m [90m0.59s[39m  
  [32;1m✓[39;22m[90m [39m[90mit rejects unsafe urls with data set #0[39m[90m                             [39m [90m0.01s[39m  
  [32;1m✓[39;22m[90m [39m[90mit rejects unsafe urls with data set #1[39m[90m                             [39m [90m0.01s[39m  
  [32;1m✓[39;22m[90m [39m[90mit rejects unsafe urls with data set #2[39m[90m                             [39m [90m0.01s[39m  
  [32;1m✓[39;22m[90m [39m[90mit rejects unsafe urls with data set #3[39m[90m                             [39m [90m0.01s[39m  
  [32;1m✓[39;22m[90m [39m[90mit rejects unsafe urls with data set #4[39m[90m                             [39m [90m0.01s[39m  

  [30;42;1m PASS [39;49;22m[39m Tests\Feature\AnalyticsTrustAndDomainsTest[39m
  [32;1m✓[39;22m[90m [39m[90mlink owner can view bilingual analytics and export csv[39m[90m              [39m [90m0.07s[39m  
  [32;1m✓[39;22m[90m [39m[90mblocked host cannot be shortened[39m[90m                                    [39m [90m0.02s[39m  
  [32;1m✓[39;22m[90m [39m[90monly admin can access dynamic administration path[39m[90m                   [39m [90m0.03s[39m  
  [32;1m✓[39;22m[90m [39m[90mverified external domain can become default[39m[90m                         [39m [90m0.02s[39m  
  [32;1m✓[39;22m[90m [39m[90mcloudflare service provisions and refreshes hostname[39m[90m                [39m [90m0.03s[39m  

  [30;42;1m PASS [39;49;22m[39m Tests\Feature\ApiAuthenticationTest[39m
  [32;1m✓[39;22m[90m [39m[90mhashed bearer token can create a link[39m[90m                               [39m [90m0.02s[39m  
  [32;1m✓[39;22m[90m [39m[90mread only token cannot create a link[39m[90m                                [39m [90m0.01s[39m  
  [32;1m✓[39;22m[90m [39m[90minvalid token is rejected[39m[90m                                           [39m [90m0.01s[39m  

  [30;42;1m PASS [39;49;22m[39m Tests\Feature\InstallationAndLocaleTest[39m
  [32;1m✓[39;22m[90m [39m[90muninstalled application redirects to the browser installer[39m[90m          [39m [90m0.02s[39m  
  [32;1m✓[39;22m[90m [39m[90memail verification requires smtp during browser installation[39m[90m        [39m [90m0.02s[39m  
  [32;1m✓[39;22m[90m [39m[90mlanguage can be switched between chinese and english[39m[90m                [39m [90m0.02s[39m  
  [32;1m✓[39;22m[90m [39m[90mconfigured administration path is the only admin entry[39m[90m              [39m [90m0.02s[39m  
  [32;1m✓[39;22m[90m [39m[90mpublic pages render in both supported languages[39m[90m                     [39m [90m0.02s[39m  

  [30;42;1m PASS [39;49;22m[39m Tests\Feature\LinkFlowTest[39m
  [32;1m✓[39;22m[90m [39m[90mauthenticated user can create and resolve a link[39m[90m                    [39m [90m0.02s[39m  
  [32;1m✓[39;22m[90m [39m[90mduplicate slug is rejected on the same host[39m[90m                         [39m [90m0.02s[39m  
  [32;1m✓[39;22m[90m [39m[90mplatform route slug is rejected[39m[90m                                     [39m [90m0.01s[39m  

  [90mTests:[39m    [32;1m22 passed[39;22m[90m (76 assertions)[39m
  [90mDuration:[39m [39m1.07s[39m

```
