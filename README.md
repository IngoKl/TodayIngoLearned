# TodayIngoLearned

![TodayIngoLearned](https://github.com/IngoKl/TodayIngoLearned/blob/master/static/images/icons/app-icon-144.png?raw=true)

*TodayIngoLearned* is a small personal project that I started to experiment with PWAs and full-stack Node.js a while back. It's a personal knowledge/learning management system used for every day (informal) learning. Since I now actually use the tool as part of my personal knowledge/learning management, I wanted to share it!

**Be aware:** As I started this as a personal learning project to learn about Node.js and some other technologies, the code is really not very good and leaves a lot to be desired. I hope that at some point I'll find the time to really go back to this!

You can find a detailed blog post about this project and its scope on [my personal website](https://kleiber.me/blog/2020/05/31/today-ingo-learned-personal-learning-management-system/).

## Use Case and Features

TodayIngoLearned (inspired by [reddit.com/r/todayilearned](https://www.reddit.com/r/todayilearned/)) is essentially a database in which you can store whatever your learned on a particular day. Each learning is one *TIL* - an entry in the database containing information about what you've learned.

### Features

* Progressive Web App (PWA) – installable on Android/iOS (very limited caching)
* Multi-user support
* Markdown support
* Tagging TILs using hashtags
* Commenting existing TILs
* Bookmarking
* Searching for titles, hashtags, and dates
* Viewing random TILs
* Basic spaced repetition system for studying TILs
* Rudimentary dark mode
* Export TILs as markdown

## Usage

### CLI

The CLI (`install.js`) support the following commands:

| Command                   | Description                                |
|---------------------------|--------------------------------------------|
| createdb                  | Create an empty SQLite database.           |
| populatedb                | Initiate an empty DB and add a first user. |
| backupdb                  | Create a backup of the current DB.         |
| adduser user pass         | Add a new user to the system.              |
| listusers                 | List all users.                            |
| setuserpassword user pass | Change a user's password.                  |
| refreshtags               | Regenerate and refresh all tags.           |
| showtil id                | Show TIL based on its id.                  |
| generatetils count        | Generate random TILs.                      |
| fixnulldates              | Fix TILs with NULL dates by using the date of the previous TIL. |

### Internal Linking

You can link to other TILs using the `[[Title]]` syntax.

### ToDo

I use a `#todo` tag to label TILs that require further works. For example, sometimes I don't have the time to immediately write a TIL. Hence, the navigation has a shortcut to `/tag/todo`.

## Installation

### Traditional Way

![TodayIngoLearned-Install](https://user-images.githubusercontent.com/16179317/83356486-cf695580-a366-11ea-9b97-6f53e7b8cea1.gif)

```bash
npm install

node install.js createdb
node install.js populatedb

node server.js
```

Also consider the settings in `config.json`. If the option `lowercasetags` is `true`, all tags will be converted to lowercase. Also make sure to change the `expresssessionsecret`.

If you plan on running this 'in production' 😅, I would recommend using [pm2](https://pm2.keymetrics.io) to run the server.

```bash
npm install pm2 -g
pm2 start server.js
```

The `install.js` script also will allow you to create new users (`node install.js newuser username password`) and to change a user's password (`node install.js setuserpassword username new_password`). Use `node install.js refreshtags` to refresh/rebuild all tags.

### Docker

Alternatively, you can create your own [Docker](https://www.docker.com) container to run TodayIngoLearned. I've provided a very rudimentary Dockerfile (not based on pm2) in the repository to get you started.

## Development

Use `nodemon server.js` to get a development server up and running.
