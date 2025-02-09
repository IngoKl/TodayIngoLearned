# Changelog

## Version 1.0.3 (2021-10-30)

* Added basic text search
* Added rudimentary dark mode using `Darkmode.js`
* Updated to `bootstrap` 5, `ejs` 3, and `font-awesome` 6
* Updated template for `bootstrap` 5
* Fixed a bookmarking redirect issue
* Fixed comment formatting

## Version 1.0.4 (2021-11-10)

* Added CLI information to the readme file
* Added TIL markdown export

## Version 1.0.5 (2024-02-10)

* Added CLI command to show users
* Added CLI command to show a TIL based on its id
* Added a button to delete commens from the main view
* Added a very basic user/profile page
* Changed URLs feature so that they open in a new tab by default
* Changed JSON endpoint so that tags are private (user-specific)

## Version 1.0.6 (2024-02-12)

* Added a comment view (`/comment/view/$id`)
* Added a list of all tags
* Added a logout button
* Added a version hint
* Added screenshots to `manifest.json`
* Changed createdb so that db specified in the config.json is created
* Fixed footer padding
* Harmonized the regular expressions used for hashtags
* Moved `get_day_range` to helpers as `getDateRange`
* Optimized routing and overall project structure
* Optimized the UI in some minor ways
* Removed dependency `parse-hashtags`
* Removed unused /todo url

## Version 1.0.7 (2025-02-08)

* Added support for umlauts in tags
* Added a Python helper script to resize application icon
* Updated the application icon
* Updated dependencies (for increased security)
* Updated the in some minor ways (e.g., Spacing on the login page)
* Removed the Darkmode.js CDN depedency
* Fixed a routing bug related to bookmarking
* Matched GitHub and `package.json` keywords

## Version 1.0.8 (XXXX-XX-XX)

* Added timeline feature
* Added a function to generate random TILs for testing
* Added a functon to fix TILs with NULL-dates
* Optimized the UI in some minor ways
* Fixed app icons
* Fixed missing showtil functionality in `install.js`
