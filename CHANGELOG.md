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

## Version 1.0.6 (XXXX-XX-XX)

* Added a version hint
* Added a list of all tags
* Added a comment view (`/comment/view/$id`)
* Added a logout button
* Removed dependency `parse-hashtags`
* Harmonized the regular expressions used for hashtags
* Changed createdb so that db specified in the config.json is created
* Moved `get_day_range` to helpers as `getDateRange`
* Removed unused /todo url
* Optimized routing and overall project structure
* Optimized the UI in some minor ways
* Fixed footer padding
