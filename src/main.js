const path = require('path');
// 找到要执行的核心文件
// 1、解析用户的参数
const program = require('commander');
const { version } = require('./constants');

const mapActions = {
  create: {
    alias: 'c',
    description: 'create a project',
    examples: [
      'zc-cli create <project-name>',
    ],
  },
  config: {
    alias: 'conf',
    description: 'config a project variable',
    examples: [
      'zc-cli config set <k> <v>',
      'zc-cli config get <k>',
    ],
  },
  '*': {
    alias: '',
    description: 'commander not found',
    examples: [],
  },
};
console.log(process.argv);
Reflect.ownKeys(mapActions).forEach((action) => {
  program
    .command(action) // 配置命令的名字
    .alias(mapActions[action].alias) // 参数别名
    .description(mapActions[action].description) // 命令对应的描述
    .action(() => {
      if (action === '*') {
        console.log(mapActions[action].description);
      } else {
        require(path.resolve(__dirname, action))(...process.argv.slice(3));
      }
    });
});

// 监听用户的help
program.on('--help', () => {
  Reflect.ownKeys(mapActions).forEach((action) => {
    mapActions[action].examples.forEach((example) => {
      console.log(` ${example}`);
    });
  });
});

// 解析用户传递的参数
program.version(version).parse(process.argv);
