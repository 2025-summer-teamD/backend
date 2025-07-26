const prisma = require('../src/config/prisma');

describe('Prisma DB 연결 및 스키마 확인', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('DB에 정상적으로 연결되고 ChatRoom, Persona 테이블이 존재해야 한다', async () => {
    // PostgreSQL의 information_schema를 이용해 테이블 존재 확인
    const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    const tableNames = tables.map(t => t.table_name);
    expect(tableNames).toContain('ChatRoom');
    expect(tableNames).toContain('Persona');
    expect(tableNames).toContain('ChatLog');
    expect(tableNames).toContain('User');
  });
}); 