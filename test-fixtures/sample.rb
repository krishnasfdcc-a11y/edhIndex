require 'json'
require 'digest'
require 'securerandom'
require 'set'
require 'monitor'

module UserRoles
  ADMIN = :admin
  USER = :user
  VIEWER = :viewer
end

class UserConfig
  attr_accessor :name, :email, :role, :settings

  def initialize(name:, email:, role: UserRoles::VIEWER, settings: {})
    @name = name
    @email = email
    @role = role
    @settings = settings
    @created_at = Time.now
  end

  def validate
    return false if @name.nil? || @name.length < 2
    return false unless @email.include?('@')
    return false unless [UserRoles::ADMIN, UserRoles::USER, UserRoles::VIEWER].include?(@role)
    true
  end

  def to_h
    { name: @name, email: @email, role: @role, created_at: @created_at.iso8601 }
  end
end

class ApiResponse
  attr_reader :status, :data, :message, :timestamp

  def initialize(status:, data: nil, message:)
    @status = status
    @data = data
    @message = message
    @timestamp = (Time.now.to_f * 1000).to_i
  end

  def ok?
    @status >= 200 && @status < 300
  end

  def to_h
    { status: @status, data: @data, message: @message, timestamp: @timestamp }
  end
end

class BaseService
  def initialize(base_url, timeout = 5)
    @base_url = base_url
    @timeout = timeout
  end

  def log(method, path)
    puts "[#{method}] #{@base_url}#{path}"
  end
end

class UserService < BaseService
  include MonitorMixin

  def initialize
    super('https://api.example.com/users')
    @users = {}
    @listeners = []
    super() # init monitor
  end

  def get_user(id)
    synchronize do
      user = @users[id]
      return ApiResponse.new(status: 404, message: 'Not found') unless user
      @listeners.each { |l| l.call(:fetched, user) }
      ApiResponse.new(status: 200, data: user.to_h, message: 'OK')
    end
  end

  def create_user(config)
    return ApiResponse.new(status: 400, message: 'Invalid config') unless config.validate
    id = SecureRandom.hex(16)
    synchronize do
      @users[id] = config
    end
    @listeners.each { |l| l.call(:created, config) }
    ApiResponse.new(status: 201, data: config.to_h, message: 'Created')
  end

  def update_user(id, updates)
    synchronize do
      user = @users[id]
      return ApiResponse.new(status: 404, message: 'Not found') unless user
      user.name = updates[:name] if updates.key?(:name)
      user.email = updates[:email] if updates.key?(:email)
      ApiResponse.new(status: 200, data: user.to_h, message: 'Updated')
    end
  end

  def delete_user(id)
    synchronize do
      return ApiResponse.new(status: 404, message: 'Not found') unless @users.key?(id)
      @users.delete(id)
    end
    ApiResponse.new(status: 200, message: 'Deleted')
  end

  def list_users
    synchronize do
      @users.values.map(&:to_h)
    end
  end

  def on_event(&block)
    @listeners << block
  end
end

module Utils
  def self.calculate_hash(content)
    Digest::SHA256.hexdigest(content)
  end

  def self.validate_email(email)
    email&.include?('@') && email&.include?('.')
  end

  def self.paginate(items, page, per_page)
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page - 1
    pages = (items.length.to_f / per_page).ceil
    { items: items[start_idx..end_idx] || [], total: items.length, pages: pages }
  end

  def self.read_config(path)
    JSON.parse(File.read(path))
  rescue JSON::ParserError, Errno::ENOENT
    {}
  end

  def self.write_config(path, config)
    File.write(path, JSON.pretty_generate(config))
  end

  def self.retry(times, delay, &block)
    attempts = 0
    begin
      attempts += 1
      block.call
    rescue StandardError => e
      raise e if attempts >= times
      sleep(delay)
      retry
    end
  end
end
