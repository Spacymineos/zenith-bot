// ecosystem.config.cjs — PM2 process config (alternative to Docker)
module.exports = {
  apps: [
    {
      name:          'zenith',
      script:        'index.js',
      instances:     1,           // single instance (Discord bot is stateful)
      exec_mode:     'fork',
      node_args:     '--experimental-vm-modules',
      watch:         false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
      },
      // Structured logging
      error_file: './logs/error.log',
      out_file:   './logs/out.log',
      log_file:   './logs/combined.log',
      time:       true,
      // Auto-restart settings
      autorestart:        true,
      restart_delay:      5000,
      max_restarts:       10,
      min_uptime:         '10s',
      // Graceful shutdown
      kill_timeout:       5000,
      listen_timeout:     3000,
      shutdown_with_message: false,
    },
  ],
};
