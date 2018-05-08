var inquirer = require('inquirer')

inquirer
  .prompt([
    {
      type: 'list',
      name: 'mountpoint',
      message: 'Pick a mountpoint for transfer playlists',
      choices: ['/media/jun/WALKMAN', '/media/jun/WALKMAN1']
    }
  ])
  .then(answers => {
    console.log(answers)
  })
