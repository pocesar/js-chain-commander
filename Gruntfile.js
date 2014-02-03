module.exports = function(grunt) {
  grunt.initConfig({
    'mocha_istanbul': {
      coverage: {
        src: 'test',
        options: {
          quiet: true
        }
      },
      coveralls: {
        src: 'test',
        options: {
          coverage: true,
          quiet: true
        }
      }
    }
  });

  grunt.event.on('coverage', function(data){
    require('coveralls').handleInput(data, function(){ });
  });

  grunt.loadNpmTasks('grunt-mocha-istanbul');

  grunt.registerTask('coveralls', ['mocha_istanbul:coveralls']);
  grunt.registerTask('coverage', ['mocha_istanbul:coverage']);

};