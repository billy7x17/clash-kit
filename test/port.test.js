import { describe, it, expect } from 'vitest'
import { extractPort } from '../lib/port.ts'

describe('extractPort', () => {
  it('should return the number itself when given a number', () => {
    expect(extractPort(9090)).toBe(9090)
    expect(extractPort(7890)).toBe(7890)
  })

  it('should return null for 0 (falsy value treated as invalid)', () => {
    expect(extractPort(0)).toBeNull()
  })

  it('should parse a pure numeric string', () => {
    expect(extractPort('9090')).toBe(9090)
    expect(extractPort('7890')).toBe(7890)
    expect(extractPort('65535')).toBe(65535)
  })

  it('should extract port from "host:port" format', () => {
    expect(extractPort('127.0.0.1:9090')).toBe(9090)
    expect(extractPort('0.0.0.0:7890')).toBe(7890)
    expect(extractPort('192.168.1.1:8080')).toBe(8080)
  })

  it('should extract port from ":port" format', () => {
    expect(extractPort(':9090')).toBe(9090)
    expect(extractPort(':7890')).toBe(7890)
  })

  it('should extract port from IPv6 address with port', () => {
    expect(extractPort('[::1]:9090')).toBe(9090)
    expect(extractPort('[::]:8080')).toBe(8080)
  })

  it('should return null for falsy values', () => {
    expect(extractPort(null)).toBeNull()
    expect(extractPort(undefined)).toBeNull()
    expect(extractPort('')).toBeNull()
  })

  it('should return null for invalid inputs', () => {
    expect(extractPort('not-a-port')).toBeNull()
    expect(extractPort('abc:def')).toBeNull()
    expect(extractPort(':::')).toBeNull()
  })

  it('should trim whitespace from string inputs', () => {
    expect(extractPort('  9090  ')).toBe(9090)
    expect(extractPort('  :7890  ')).toBe(7890)
  })
})
