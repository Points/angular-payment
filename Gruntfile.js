var markdown = require('node-markdown').Markdown;

module.exports = function (grunt) {
    'use strict';

    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-html2js');
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-conventional-changelog');
    grunt.loadNpmTasks('grunt-ngdocs');

    // Project configuration.
    grunt.util.linefeed = '\n';

    grunt.initConfig({
        ngversion: '1.2.23',
        bsversion: '3.0.0',
        modules: [], //to be filled in by build task
        pkg: grunt.file.readJSON('package.json'),
        dist: 'dist',
        filename: 'angular-payment',
        filenamecustom: '<%= filename %>-custom',
        meta: {
            modules: 'angular.module("payment", [<%= srcModules %>]);',
            tplmodules: 'angular.module("payment.tpls", [<%= tplModules %>]);',
            all: 'angular.module("payment", ["payment.tpls", <%= srcModules %>]);'
        },
        delta: {
            html: {
                files: ['template/**/*.html'],
                tasks: ['html2js', 'karma:watch:run']
            },
            js: {
                files: ['src/**/*.js'],
                //we don't need to jshint here, it slows down everything else
                tasks: ['karma:watch:run']
            }
        },
        concat: {
            dist: {
                options: {
                    banner: '<%= meta.modules %>\n'
                },
                src: [], //src filled in by build task
                dest: '<%= dist %>/<%= filename %>.js'
            },
            dist_tpls: {
                options: {
                    banner: '<%= meta.all %>\n<%= meta.tplmodules %>\n'
                },
                src: [], //src filled in by build task
                dest: '<%= dist %>/<%= filename %>-tpls.js'
            }
        },
        copy: {
            demohtml: {
                options: {
                    //process html files with gruntfile config
                    processContent: grunt.template.process
                },
                files: [
                    {
                        expand: true,
                        src: ["**/*.html"],
                        cwd: "misc/demo/",
                        dest: "dist/"
                    }
                ]
            },
            demoassets: {
                files: [
                    {
                        expand: true,
                        //Don't re-copy html files, we process those
                        src: ["**/**/*", "!**/*.html"],
                        cwd: "misc/demo",
                        dest: "dist/"
                    }
                ]
            }
        },
        uglify: {
            dist: {
                src: ['<%= dist %>/<%= filename %>.js'],
                dest: '<%= dist %>/<%= filename %>.min.js'
            },
            dist_tpls: {
                src: ['<%= dist %>/<%= filename %>-tpls.js'],
                dest: '<%= dist %>/<%= filename %>-tpls.min.js'
            }
        },
        html2js: {
            dist: {
                options: {
                    module: null, // no bundle module for all the html2js templates
                    base: '.'
                },
                files: [
                    {
                        expand: true,
                        src: ['template/**/*.html'],
                        ext: '.html.js'
                    }
                ]
            }
        },
        jshint: {
            files: ['Gruntfile.js', 'src/**/*.js'],
            options: {
                curly: true,
                immed: true,
                newcap: true,
                noarg: true,
                sub: true,
                boss: true,
                eqnull: true,
                globals: {
                    angular: true
                }
            }
        },
        karma: {
            options: {
                configFile: 'karma.conf.js'
            },
            watch: {
                background: true
            },
            continuous: {
                singleRun: true
            },
            travis: {
                singleRun: true,
                browsers: ['Firefox']
            }
        },
        changelog: {
            options: {
                dest: 'CHANGELOG.md',
                templateFile: 'misc/changelog.tpl.md'
            }
        },
        shell: {
            //We use %version% and evaluate it at run-time, because <%= pkg.version %>
            //is only evaluated once
            'release-prepare': [
                'grunt before-test after-test',
                'grunt version', //remove "-SNAPSHOT"
                'grunt changelog'
            ],
            'release-complete': [
                'git commit CHANGELOG.md package.json -m "chore(release): v%version%"',
                'git tag %version%'
            ],
            'release-start': [
                'grunt version:minor:"SNAPSHOT"',
                'git commit package.json -m "chore(release): Starting v%version%"'
            ]
        },
        ngdocs: {
            options: {
                dest: 'dist/docs',
                scripts: [
                    'angular.js',
                    '<%= concat.dist_tpls.dest %>'
                ],
                styles: [
                    'docs/css/style.css'
                ],
                navTemplate: 'docs/nav.html',
                title: 'angular-payment',
                html5Mode: false
            },
            api: {
                src: ["src/**/*.js", "src/**/*.ngdoc"],
                title: "API Documentation"
            }
        }
    });

    //register before and after test tasks so we've don't have to change cli
    //options on the google's CI server
    grunt.registerTask('before-test', ['enforce', 'jshint', 'html2js']);
    grunt.registerTask('after-test', ['build', 'copy']);

    //Rename our watch task to 'delta', then make actual 'watch'
    //task build things, then start test server
    grunt.renameTask('watch', 'delta');
    grunt.registerTask('watch', ['before-test', 'after-test', 'karma:watch', 'delta']);

    // Default task.
    grunt.registerTask('default', ['before-test', 'test', 'after-test']);

    grunt.registerTask('enforce', 'Install commit message enforce script if it doesn\'t exist', function () {
        if (!grunt.file.exists('.git/hooks/commit-msg')) {
            grunt.file.copy('misc/validate-commit-msg.js', '.git/hooks/commit-msg');
            require('fs').chmodSync('.git/hooks/commit-msg', '0755');
        }
    });

    //Common payment module containing all modules for src and templates
    //findModule: Adds a given module to config
    var foundModules = {};

    function findModule(name) {
        if (foundModules[name]) {
            return;
        }
        foundModules[name] = true;

        function breakup(text, separator) {
            return text.replace(/[A-Z]/g, function (match) {
                return separator + match;
            });
        }

        function ucwords(text) {
            return text.replace(/^([a-z])|\s+([a-z])/g, function ($1) {
                return $1.toUpperCase();
            });
        }

        function enquote(str) {
            return '"' + str + '"';
        }

        var module = {
            name: name,
            moduleName: enquote('payment.' + name),
            displayName: ucwords(breakup(name, ' ')),
            srcFiles: grunt.file.expand("src/" + name + "/*.js"),
            tplFiles: grunt.file.expand("template/" + name + "/*.html"),
            tpljsFiles: grunt.file.expand("template/" + name + "/*.html.js"),
            tplModules: grunt.file.expand("template/" + name + "/*.html").map(enquote),
            dependencies: dependenciesForModule(name),
            docs: {
                md: grunt.file.expand("src/" + name + "/docs/*.md")
                    .map(grunt.file.read).map(markdown).join("\n"),
                js: grunt.file.expand("src/" + name + "/docs/*.js")
                    .map(grunt.file.read).join("\n"),
                html: grunt.file.expand("src/" + name + "/docs/*.html")
                    .map(grunt.file.read).join("\n")
            }
        };
        module.dependencies.forEach(findModule);
        grunt.config('modules', grunt.config('modules').concat(module));
    }

    function dependenciesForModule(name) {
        var deps = [];
        grunt.file.expand('src/' + name + '/*.js')
            .map(grunt.file.read)
            .forEach(function (contents) {
                //Strategy: find where module is declared,
                //and from there get everything inside the [] and split them by comma
                var moduleDeclIndex = contents.indexOf('angular.module('),
                    depArrayStart = contents.indexOf('[', moduleDeclIndex),
                    depArrayEnd = contents.indexOf(']', depArrayStart),
                    dependencies = contents.substring(depArrayStart + 1, depArrayEnd);
                dependencies.split(',').forEach(function (dep) {
                    if (dep.indexOf('payment.') > -1) {
                        var depName = dep.trim().replace('payment.', '').replace(/['"]/g, '');
                        if (deps.indexOf(depName) < 0) {
                            deps.push(depName);
                            //Get dependencies for this new dependency
                            deps = deps.concat(dependenciesForModule(depName));
                        }
                    }
                });
            });
        return deps;
    }

    grunt.registerTask('dist', 'Override dist directory', function () {
        var dir = this.args[0];
        if (dir) {
            grunt.config('dist', dir);
        }
    });

    grunt.registerTask('build', 'Create angular-payment build files', function () {
        var _ = grunt.util._, modules, srcFiles, tpljsFiles;

        //If arguments define what modules to build, build those. Else, everything
        if (this.args.length) {
            this.args.forEach(findModule);
            grunt.config('filename', grunt.config('filenamecustom'));
        } else {
            grunt.file.expand({
                filter: 'isDirectory',
                cwd: '.'
            }, 'src/*').forEach(function (dir) {
                findModule(dir.split('/')[1]);
            });
        }

        modules = grunt.config('modules');
        grunt.config('srcModules', _.pluck(modules, 'moduleName'));
        grunt.config('tplModules', _.pluck(modules, 'tplModules').filter(function (tpls) {
            return tpls.length > 0;
        }));
        grunt.config('demoModules', modules.filter(function (module) {
            return module.docs.md && module.docs.js && module.docs.html;
        }));

        srcFiles = _.pluck(modules, 'srcFiles');
        tpljsFiles = _.pluck(modules, 'tpljsFiles');
        //Set the concat task to concatenate the given src modules
        grunt.config('concat.dist.src', grunt.config('concat.dist.src')
            .concat(srcFiles));
        //Set the concat-with-templates task to concat the given src & tpl modules
        grunt.config('concat.dist_tpls.src', grunt.config('concat.dist_tpls.src')
            .concat(srcFiles).concat(tpljsFiles));

        grunt.task.run(['concat', 'uglify']);
    });

    grunt.registerTask('test', 'Run tests on singleRun karma server', function () {
        grunt.task.run(process.env.TRAVIS ? 'karma:travis' : 'karma:continuous');
    });

    function setVersion(type, suffix) {
        var file = 'package.json',
            VERSION_REGEX = /([\'|\"]version[\'|\"][ ]*:[ ]*[\'|\"])([\d|.]*)(-\w+)*([\'|\"])/,
            contents = grunt.file.read(file),
            version;
        contents = contents.replace(VERSION_REGEX, function (match, left, center) {
            version = center;
            if (type) {
                version = require('semver').inc(version, type);
            }
            //semver.inc strips our suffix if it existed
            if (suffix) {
                version += '-' + suffix;
            }
            return left + version + '"';
        });
        grunt.log.ok('Version set to ' + version.cyan);
        grunt.file.write(file, contents);
        return version;
    }

    grunt.registerTask('version', 'Set version. If no arguments, it just takes off suffix', function () {
        setVersion(this.args[0], this.args[1]);
    });

    grunt.registerMultiTask('shell', 'run shell commands', function () {
        var self = this,
            sh = require('shelljs');
        self.data.forEach(function (cmd) {
            cmd = cmd.replace('%version%', grunt.file.readJSON('package.json').version);
            grunt.log.ok(cmd);
            var result = sh.exec(cmd, {silent: true});
            if (result.code !== 0) {
                grunt.fatal(result.output);
            }
        });
    });

    return grunt;
};
