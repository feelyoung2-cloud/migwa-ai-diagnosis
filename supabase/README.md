# Supabase 구성 (feelyoung2-cloud's Project)

이미 적용돼 있습니다. 다시 만들 일은 없고, 기록용입니다.

- `migwa_responses`: 익명 응답. RLS 켜짐, 정책 없음 → 누구도 표를 직접 읽거나 고칠 수 없음
- `migwa_admins`: 관리자 계정(auth.users id) 목록
- `migwa_submit(payload)`: 비로그인 호출 가능. 61문항·값 검증, 점수 서버 재계산, 같은 id는 한 번만 저장
- `migwa_admin_list()` · `migwa_admin_hide(ids)` · `migwa_is_admin()`: 로그인한 관리자만 동작
- 마이그레이션 이름: `migwa_survey_init`, `migwa_revoke_anon_admin`

## 관리자 추가

1. Supabase 대시보드 → Authentication → Users → Add user (이메일·비밀번호)
2. SQL Editor에서 실행:

```sql
insert into public.migwa_admins (user_id)
select id from auth.users where email = '관리자이메일@example.com';
```

## 숨긴 응답 되살리기

```sql
update public.migwa_responses set deleted = false where seq = 번호;
```
