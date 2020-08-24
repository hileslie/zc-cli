// 创建项目
// 拉取所有项目
// 选完之后，显示版本号
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const ora = require('ora');
const Inquirer = require('inquirer');
let downloadGitRepo = require('download-git-repo');
let ncp = require('ncp');
const { promisify } = require('util');
const Metalsmith = require('metalsmith');
let { render } = require('consolidate').ejs;
const { downloadDir } = require('./constants');

downloadGitRepo = promisify(downloadGitRepo);
ncp = promisify(ncp);
render = promisify(render);

// 获取项目列表
const fetchRepoList = async () => {
  const { data } = await axios.get('https://api.github.com/orgs/zhu-cli/repos');
  return data;
};

const fetchTagList = async (repo) => {
  const { data } = await axios.get(`https://api.github.com/repos/zhu-cli/${repo}/tags`);
  return data;
};

const download = async (repo, tag) => {
  let api = `zhu-cli/${repo}`;
  if (tag) {
    api += `#${tag}`;
  }
  const dest = `${downloadDir}/${repo}`;
  await downloadGitRepo(api, dest);
  return dest;
};

const waitFnLoading = (fn, message) => async (...args) => {
  const spinner = ora(message);
  spinner.start();
  const result = await fn(...args);
  spinner.succeed();
  return result;
};

module.exports = async (projectName) => {
  const repos = waitFnLoading(fetchRepoList, 'fetching template...')();
  repos.map((item) => item.name);
  console.log(repos);

  // 选择模板
  const { repo } = await Inquirer.prompt({
    name: 'repo',
    type: 'list',
    message: '请创建',
    choices: repos,
  });

  // 通过当前选择的项目，拉取对应版本
  const tags = waitFnLoading(fetchTagList, 'fetching tags...')(repo);
  tags.map((item) => item.name);
  const { tag } = await Inquirer.prompt({
    name: 'tag',
    type: 'list',
    message: '请创建',
    choices: tags,
  });

  // 下载模板后放到一个临时目录 download-git-repo
  const result = waitFnLoading(download, 'download...')(repo, tag);

  // 2、复杂模板
  // 把git上的项目下载下来，是否有ask文件，用户选择，编译模板
  if (!fs.existsSync(path.join(result, 'ask.js'))) {
    // 1、简单模板：拿到下载的目录，拷贝到当前执行的目录下 ncp
    await ncp(result, path.resolve(projectName));
  } else {
    await new Promise((resolve, reject) => {
      Metalsmith(__dirname)
        .source(result)
        .destination(result, path.resolve(projectName))
        .use(async (files, metal, done) => {
          const args = require(path.join(result, 'ask.js'));
          const res = await Inquirer.prompt(args);
          const meta = metal.metadata();
          Object.assign(meta, res);
          delete files['ask.js'];
          done();
        })
        .use(async (files, metal, done) => {
          const obj = metal.metadata();
          Reflect.ownKeys(files).forEach(async (file) => {
            if (file.includes('js') || file.includes('json')) {
              let content = files[file].contents.toString();
              if (content.includes('<%')) {
                content = await render(content, obj);
                files[file].contents = Buffer.from(content);
              }
            }
          });
          done();
        })
        .build((err) => {
          if (err) {
            reject();
          } else {
            resolve();
          }
        });
    });
    // 让用户填写信息，并且渲染
  }
};
