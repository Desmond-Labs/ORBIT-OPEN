-- WARNING: This function executes any SQL string passed to it as a superuser.
    -- It provides great power and must be used with extreme care.
     -- Ensure it is only called from trusted server-side environments (like your agent)
     -- and never from the client-side.
     
     create or replace function execute_sql(query text)
     returns jsonb as $$
    declare
      result jsonb;
    begin
      -- Execute the query as the postgres superuser
      set role postgres;
      execute query into result;
      reset role;
      return result;
    end;
    $$ language plpgsql security definer;