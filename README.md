### README
将wrangler.toml.example 拷贝的wrangler.toml将里面的信息填改下

### 数据库
```
create table gemini;
alter table gemini add column content text default "";
alter table gemini add column created_at text default "";
alter table gemini add column ip text default "";
alter table gemini add column country text default "";
alter table gemini add column city text default "";
alter table gemini add column asOrganization text default "";
alter table gemini add column imgName text default "";
alter table gemini add column mimeType text default "";
alter table gemini add column latitude text default "";
alter table gemini add column longitude text default "";
alter table gemini add column timezone text default "";
alter table gemini add column apiKey text default "";

```
