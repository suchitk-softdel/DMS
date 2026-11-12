import SearchIcon from '@mui/icons-material/Search'
import Button from '@mui/material/Button'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'

/**
 * Generic filter row: optional search, select filters, date range and extra
 * controls. It holds no state; the page owns the filter values.
 *
 * selects: [{ key, label, value, options: [{ value, label }], onChange(value) }]
 *   (e.g. a dealer filter: options built from the dealer list)
 * dateRange: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } + onDateRangeChange({ from, to })
 */
export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  selects = [],
  dateRange,
  onDateRangeChange,
  onReset,
  children,
}) {
  const showSearch = typeof onSearchChange === 'function'
  const showDateRange = Boolean(dateRange && onDateRangeChange)

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        useFlexGap
        sx={{ flexWrap: 'wrap', alignItems: { md: 'center' } }}
      >
        {showSearch && (
          <TextField
            size="small"
            placeholder={searchPlaceholder}
            value={search ?? ''}
            onChange={(event) => onSearchChange(event.target.value)}
            sx={{ minWidth: 240, flexGrow: 1 }}
            slotProps={{
              htmlInput: { 'aria-label': searchPlaceholder },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}

        {selects.map(({ key, label, value, options, onChange }) => (
          <TextField
            key={key}
            select
            size="small"
            label={label}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            sx={{ minWidth: 180 }}
          >
            {options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        ))}

        {showDateRange && (
          <>
            <TextField
              type="date"
              size="small"
              label="From"
              value={dateRange.from ?? ''}
              onChange={(event) => onDateRangeChange({ ...dateRange, from: event.target.value })}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: dateRange.to } }}
            />
            <TextField
              type="date"
              size="small"
              label="To"
              value={dateRange.to ?? ''}
              onChange={(event) => onDateRangeChange({ ...dateRange, to: event.target.value })}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: dateRange.from } }}
            />
          </>
        )}

        {children}

        {onReset && (
          <Button onClick={onReset} sx={{ ml: { md: 'auto' } }}>
            Reset
          </Button>
        )}
      </Stack>
    </Paper>
  )
}
