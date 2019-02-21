var allBookData;
var allEventData;

// Loads all datasets and calls init.
function load_data() {
  // Book data.
  d3.csv("data/books_master_file.csv", function(error, data) {
    if (error) throw error;
    // Keyword data.
    d3.csv("data/keywords.csv", function(error2, keyword_data) {
      if (error2) throw error2;
      // Event data.
      d3.tsv("data/space_exploration_events.tsv",
          function(error3, event_data) {
        if (error3) throw error3;
        init(data, keyword_data, event_data);
      });
    });
  });
}

// Initializes the vis.
function init(data, keyword_data, event_data){
  console.log("Loaded " + data.length + " books.");
  console.log("Loaded " + keyword_data.length + " book-keyword pairs.");
  allBookData = data;
  allEventData = event_data;

  console.time('pre-process data');
  // Pre-process book/keyword data.
  data.forEach(function(d) {
      d["selected"] = true;
      //d["Planet"] = +d["Planet"];
      d["Year of Publication"] = +d["Year of Publication"];
      d["polarity"] = +d["polarity"];
      d["subjectivity"] = +d["subjectivity"];
      d["sentiment"] =
          [d["polarity"], d["subjectivity"]];
      // Collect keywords for book.
      var bookKeywords = keyword_data.filter(function(k){
        return k["id"] == d["Goodreads Id"];
      });
      bookKeywords = bookKeywords.map(function(d){
        return {"keyword": d["keyword"], "count": +d["count"]};
      });
      d["keywords"] = bookKeywords;
  });
  // Pre-process event data.
  allEventData.forEach(function(d) {
    d["Date"] = new Date(d["Date"]);
  });
  console.timeEnd('pre-process data');

  // Initialize visual components.
  init_bookshelf(data);
  init_timeline(data);
  init_planets(data);
  init_keywords(data);
  init_sentiment(data);
  update_all_visual_components(data);
}

function update_all_visual_components(data) {
  console.time('update visual components');
  update_filters(data, allFilters);
  update_bookshelf(data);
  update_timeline(data);
  update_planets(data);
  update_authors(data);
  update_keywords(data);
  update_sentiment(data);
  console.timeEnd('update visual components');
}

function get_selected_books(data) {
  return data.filter(function(d) { return d["selected"]; });
}

///////////////
//  FILTERS  //
///////////////
var allFilters = [];
var decimalFormat = d3.format(".2f");

// Applies filter to the data selection.
function add_filter(data, filter) {
  // Add filter to list.
  for (var i = 0; i <= allFilters.length - 1; i++) {
    if(filter["attr_name"] == allFilters[i]["attr_name"]) {

      if(filter["filter_value"] == allFilters[i]["filter_value"]) {
        console.log("Filter already in list.");
        return;
      } else if(filter["attr_name"] == "Year of Publication") {
        allFilters.splice(i, 1);
        break;
      }
    }
  }

  allFilters.push(filter);
  // Update data selection.
  data.forEach(function(d) {
    var attrVal = d[filter["attr_name"]];
    var filterVal = filter["filter_value"];
    var filterOp = filter["operator"];
    if (!filterOp(attrVal, filterVal)) {
      d["selected"] = false;  // can break here
    }
  });

  // Update visual components.
  update_all_visual_components(data);
}

// Removes filter from the data selection.
function remove_filter(
    data, filter, ignore_callback = false, update_vis = true) {
  // Remove filter from list.
  var filterIndex = allFilters.indexOf(filter);
  if (filterIndex < 0) {
    console.log("Filter not in list.");
    return;
  }
  allFilters.splice(filterIndex, 1);

  // Execute callback if specified.
  if (!ignore_callback && "on_remove_callback" in filter) {
    filter["on_remove_callback"]();
  }

  // Update data selection.
  data.forEach(function(d) {
    d["selected"] = true;
    allFilters.forEach(function(filter) {
      var attrVal = d[filter["attr_name"]];
      var filterVal = filter["filter_value"];
      var filterOp = filter["operator"];
      if (!filterOp(attrVal, filterVal)) {
        d["selected"] = false;  // can break here
      }
    });
  });

  // Update visual components.
  if (update_vis) update_all_visual_components(data);
}

// Remove first occurence of specified filter if found.
function remove_filter_by_attr_name(
    data, attr_name, ignore_callback, update_vis) {
  for (i = 0; i < allFilters.length; ++i) {
    if (allFilters[i]["attr_name"] == attr_name) {
      remove_filter(data, allFilters[i], ignore_callback, update_vis);
      break;
    }
  }
}

// Updates filters shown on the page.
function update_filters(data, filters) {
  var filterContainer = d3.select("#filter-container");
  filterContainer.select(".no-filter-message").remove();
  filterContainer.selectAll(".filter").remove();

  // Show a message if no filters are applied.
  if (allFilters.length == 0) {
    filterContainer.append("span")
      .classed("no-filter-message", true)
      .html("No filters applied.")
      .style("color", "#BBB")
      .style("font-size", "12px");
    return;
  }

  // Add a visual element for each filter.
  allFilters.forEach(function(filter) {
    filterContainer.append("div")
      .classed("filter", true)
      .html(_format_attr_name(filter) + ": "
          + _format_filter_value(filter) + "&nbsp;")
      .append("span")
        .attr("class", "glyphicon glyphicon-remove")
        .style("cursor", "pointer")
        .on("click", function() {
          remove_filter(data, filter);
        })
  });
}

// Formats the attribute name to display on screen.
function _format_attr_name(filter) {
  var attrName = filter["attr_name"];

  switch (attrName) {
    case "sentiment":
      return "polarity, subjectivity";
      break;
    default:
      return attrName;
  }
}

// Formats the filter value to display on screen.
function _format_filter_value(filter) {
  var attrName = filter["attr_name"];
  var filterValue = filter["filter_value"];

  // Format the value based on the filtered attribute.
  switch (attrName) {
    case "Year of Publication":
      if (typeof(filterValue) == "object") {  // range, rather than single year
        return filterValue[0] + " to " + filterValue[1];
      }
      break;
    case "keywords":
      return "\"" + filterValue + "\"";
      break;
    case "sentiment":
      var minPos = filterValue[1][0],
          maxPos = filterValue[0][0],
          minSubj = filterValue[1][1],
          maxSubj = filterValue[0][1],
          meanPos = (maxPos + minPos) / 2,
          meanSubj = (maxSubj + minSubj) / 2;
      // Positivity label.
      var posLabel = meanPos > posThreshold ? "positive" : "negative";
      if (Math.abs(meanPos) < posThreshold) {
        posLabel = "neutral";
      }
      if (Math.abs(meanPos) > veryPosThreshold) {
        posLabel = "very " + posLabel;
      }
      // Objectivity label.
      var subjLabel = (meanSubj - 0.5) > subjThreshold ? "subjective" : "objective";
      if (Math.abs(meanSubj - 0.5) < subjThreshold) {
        subjLabel = "neutral";
      }
      if (Math.abs(meanSubj - 0.5) > verySubjThreshold) {
        subjLabel = "very " + subjLabel;
      }
      return posLabel + ", " + subjLabel;
      break;
  }
  // No formatting otherwise.
  return filterValue;
}


/////////////////
//  BOOKSHELF  //
/////////////////
const bookRatio = 1.6;
const bookMargin = 3;
const bookshelfTipImageWidth = 150;
const bookshelfTipMaxSummaryLength = 400;
var bookshelf;
var bookshelfTransition;
var bookshelfTip;

function init_bookshelf(data) {
  bookshelf = d3.select("#bookshelf");

  // Bookshelf transition.
  bookshelfTransition = d3.transition()
    .duration(300)
    .ease(d3.easeLinear);
}

// Draws the current book selection.
function update_bookshelf(data) {
  // Compute the book size required to completely fill the bookcase with the
  // current selection of books.
  var selectedBooks = get_selected_books(data);
  var numBooks = selectedBooks.length;
  var bookshelf =  d3.select("#bookshelf");
  d3.select("#results-count").html(numBooks);
  if (numBooks == 0) {
    bookshelf.selectAll(".book").remove();
    return;
  }

  var totalWidth = bookshelf.node().getBoundingClientRect().width;
  var totalHeight =
      bookshelf.node().getBoundingClientRect().height - 2 * bookMargin;
  var bookWidth = 0;
  var fitsOnBookshelf = true;
  while (fitsOnBookshelf) {
    bookWidth += 1;
    var booksPerShelf = Math.floor(totalWidth / (bookWidth + bookMargin));
    var numShelves = Math.ceil(numBooks / booksPerShelf);
    var requiredHeight =
        numShelves * (bookWidth * bookRatio + bookMargin) + 2 * bookMargin;
    if (requiredHeight > totalHeight) {
      fitsOnBookshelf = false;
      bookWidth -= 1;
    }
  }
  //console.log("bookWidth: " + bookWidth);
  var bookHeight = bookWidth * bookRatio;
  var shelfHeight = bookHeight + bookMargin;
  var booksPerShelf = Math.floor(totalWidth / (bookWidth + bookMargin));
  var shelfMargin =
      (totalWidth - booksPerShelf * (bookWidth + bookMargin) - bookMargin) / 2; 

  // Bookshelf tooltip.
  bookshelfTip = d3.tip()
    .attr('class', 'd3-tip')
    .offset([0,0])
    .direction(function(d,i){
      var shelfNum = Math.floor(i / booksPerShelf);
      var placeOnShelf = i - (shelfNum * booksPerShelf);
      return (placeOnShelf > booksPerShelf / 2) ? 'w' : 'e';
    })
    .html(function(d) {
      var summary = d["Summary"].length > bookshelfTipMaxSummaryLength ?
          d["Summary"].substring(0, bookshelfTipMaxSummaryLength) + "..."
          : d["Summary"];
      var imageHTML =
          "<img src=\"/ScifiBookshelf/images/Covers/" + d["Goodreads Id"] + ".jpg\""
          + " height=\"" + bookRatio * bookshelfTipImageWidth + "\" width=\""
          + bookshelfTipImageWidth + "\" align=\"left\">";
      return "<strong>" + d["Title"] + "</strong><br>" + d["Authors"]
          + " (" + d["Year of Publication"] + ")"
          + "<br>" + imageHTML + summary;
    });
  d3.select("#bookshelf").call(bookshelfTip);  

  // Update books on shelf:
  //
  // DATA JOIN
  // Join new data with old elements, if any.
  var book = bookshelf.selectAll(".book")
    .data(selectedBooks, function(d) { return d["Goodreads Id"]; });

  // UPDATE
  // Update old elements as needed.

  // ENTER
  // Create new elements as needed.
  var newBook = book.enter().append("g")
    .classed("book", true);
  newBook.append("rect")
    .style("opacity", 0.0)
    .transition(bookshelfTransition)
    .style("stroke", "black")
    .style("opacity", 0.1);
  newBook.append("image")
    .attr("height", bookHeight)
    .attr("width", bookWidth)
    .attr("xlink:href",
      function(d) { return "/ScifiBookshelf/images/Covers/" + d["Goodreads Id"] + ".jpg"; });
  newBook
    .on("mouseover", bookshelfTip.show)
    .on("mouseout", bookshelfTip.hide)
    .on("click", function(d) {

      if(window.event.ctrlKey || window.event.metaKey) {

        window.open("https:\\www.goodreads.com/book/show/"+d["Goodreads Id"], "_blank")
      } else {
        // Filter by this book.
        add_filter(data, {
          "attr_name": "Goodreads Id",
          "operator": (attr_val, filter_val) => {
            return attr_val == filter_val;
          },
          "filter_value": d["Goodreads Id"],
        });
      }
    });

  // ENTER + UPDATE
  // After merging the entered elements with the update selection,
  // apply operations to both.
  var mergedBooks = newBook.merge(book);
  mergedBooks.transition(bookshelfTransition)
    .attr("transform", function(d, i) {
      var shelfNum = Math.floor(i / booksPerShelf);
      var placeOnShelf = i - (shelfNum * booksPerShelf);
      var x =
          placeOnShelf * (bookWidth + bookMargin) + bookMargin + shelfMargin;
      var y = shelfNum * shelfHeight + bookMargin;
      return "translate(" + x + "," + y + ")";
    });
  mergedBooks.select("rect").transition(bookshelfTransition)
      .attr("fill", function(d) { return "#DDD"; })
      .attr("height", bookHeight)
      .attr("width", bookWidth)
      .attr("stroke-width", "1")
      .attr("stroke", "#fff");
  mergedBooks.select("image").transition(bookshelfTransition)
      .attr("height", bookHeight)
      .attr("width", bookWidth);
  mergedBooks
    .style("display", "block")
    .transition(bookshelfTransition)
    .style("opacity", 1.0);

  // EXIT
  // Remove old elements as needed.
  book.exit()
    .transition(bookshelfTransition)
    .style("opacity", 0.0)
    .style("display", "none");
}


////////////////
//  TIMELINE  //
////////////////
const timelineMargin = {top: 10, right: 15, bottom: 50, left: 40};
const timelineBarMargin = 1;
const timelineBarWidth = 3;
var timelineChart;
var timelineWidth;
var timelineHeight;
var timelineXScaleBuffer = 1;  // years
var timelineXScale;
var timelineYScale;
var timelineXAxis;
var timelineYAxis;
var timelineEventTip;
var timelineTransition;

// Computes the number of books for each per year.
function compute_books_per_year(data) {
  var numBooksPerYear = d3.map();
  data.forEach(function(d) {
    var year = d["Year of Publication"];
    var numBooks = 0;
    if (numBooksPerYear.has(year)) {
      numBooks = numBooksPerYear.get(year);
    }
    numBooksPerYear.set(year, numBooks + 1);
  });
  return numBooksPerYear;
}

// Called when brush moves.
function timelineBrushMove() {
  if (d3.event.selection != null) {
    // Revert bars to initial style.
    var bars = timelineChart.selectAll(".bar").selectAll("rect");
    bars.classed("timeline-brushed-bar", false);

    // Style brushed bars.
    var brush_coords = d3.brushSelection(this);
    var x0 = brush_coords[0];
    var x1 = brush_coords[1];

    var brushedBars = bars.classed("timeline-brushed-bar", function() {
      var x = d3.select(this).attr("x");
      return x0 <= x && x1 >= x;
    });
  }
}

// Called when brush ends.
function timelineBrushEnd() {
  if (!d3.event.sourceEvent) return;  // Only transition after input.
  if (!d3.event.selection) return;  // Ignore empty selection.

  // Add filter for selected range of years.
  // TODO: remove previously-applied year filter if it has broader range.
  var brush_coords = d3.brushSelection(this);
  var startYear = d3.timeYear.round(
    timelineXScale.invert(brush_coords[0])).getFullYear();
  var endYear = d3.timeYear.round(
    timelineXScale.invert(brush_coords[1])).getFullYear();

  add_filter(allBookData, {
    "attr_name": "Year of Publication",
    "operator": (attr_val, filter_val) => {
      return filter_val[0] <= attr_val && filter_val[1] >= attr_val;
    },
    "filter_value": [startYear, endYear],
  });

  // Clear the brush selection.
  timelineChart.selectAll(".bar")
    .selectAll("rect")
      .classed("timeline-brushed-bar", false);
  d3.select(this).call(d3.event.target.move, null);
}

function init_timeline(data) {
  // Compute histogram for selected books.
  var selectedBooks = get_selected_books(data);
  var numBooksPerYear = compute_books_per_year(selectedBooks);

  // Create the chart.
  var svg = d3.select("#timeline");
  timelineChart = svg.append("g")
    .attr("transform", "translate(" +
        timelineMargin.left + "," + timelineMargin.top + ")");
  timelineWidth =
      svg.node().getBoundingClientRect().width -
          timelineMargin.left - timelineMargin.right;
  timelineHeight =
      svg.node().getBoundingClientRect().height -
          timelineMargin.top - timelineMargin.bottom;

  var legend = svg.append("g")
    .classed("legend", true)
    .attr("transform", "translate(" + (timelineWidth / 2.0 - 55) + ", "
        + (timelineHeight + timelineMargin.top + 35) + ")");
  legend.append("path")
    .style("fill", "#00B5C6")
    .style("stroke", "#00B5C6")
    .attr("x", 0)
    .attr("d", d3.symbol().type(d3.symbolSquare));
  legend.append("text")
    .attr("x", 10)
    .attr("y", 4)
    .classed("timeline-legend-text", true)
    .text("books");
  legend.append("line")
    .classed("timeline-vertical-line", true)
    .style("opacity", 0.25)
    .attr("x1", 70)
    .attr("x2", 85);
  legend.append("text")
    .attr("x", 90)
    .attr("y", 4)
    .classed("timeline-legend-text", true)
    .text("historical events");

  // Create the chart axes.
  timelineXScale = d3.scaleTime()
      .domain([new Date(d3.min(numBooksPerYear.keys()), 0, 1), new Date()])
      .range([0, timelineWidth]);
  timelineYScale = d3.scaleLinear()
      .domain([0, d3.max(numBooksPerYear.values())])
      .range([timelineHeight, 0]);
  timelineXAxis = d3.axisBottom(timelineXScale);
  timelineYAxis = d3.axisLeft(timelineYScale).ticks(5);
  timelineChart.append("g")
      .attr("class", "x-axis chart-axis")
      .attr("transform", "translate(0," + timelineHeight + ")");
  timelineChart.append("g")
      .attr("class", "y-axis chart-axis")
      .attr("transform", "translate(0,0)");
  timelineChart.select(".x-axis").call(timelineXAxis);
  timelineChart.select(".y-axis").call(timelineYAxis);
  // y-axis label
  timelineChart.append("text")
      .classed("axis-label", true)
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - timelineMargin.left)
      .attr("x", 0 - (timelineHeight / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .attr("fill", "#fff")
      .text("# books");
  // Chart brushing.
  timelineChart.append("g")
    .attr("class", "brush")
    .call(d3.brushX()
        .extent([[0, 0], [timelineWidth, timelineHeight]])
        .on("brush", timelineBrushMove)
        .on("end", timelineBrushEnd));

  // Timeline event tooltip.
  timelineEventTip = d3.tip()
    .attr('class', 'd3-tip')
    .offset([-10, 0])
    .html(function(d) {
      return d["Event"] + "<br>" + d["Date"].toLocaleDateString();
    });
  timelineChart.call(timelineEventTip);

  // Timeline transition.
  timelineTransition = d3.transition()
    .duration(300)
    .ease(d3.easeLinear);
}

// Charts the number of books over time.
function update_timeline(data) {
  // Compute histogram for selected books.
  var selectedBooks = get_selected_books(data);
  if (selectedBooks.length == 0) {
    timelineChart.selectAll(".bar").remove();
    return;
  }
  numBooksPerYear = compute_books_per_year(selectedBooks);
  // Compute events within selected date range.
  var minYearOfPublication = d3.min(selectedBooks, function(d) {
    return d["Year of Publication"];
  });
  var maxYearOfPublication = d3.max(selectedBooks, function(d) {
    return d["Year of Publication"];
  });
  var selectedEvents = allEventData.filter(function(d) {
    return d["Date"].getFullYear() >= minYearOfPublication
        && d["Date"].getFullYear() <= maxYearOfPublication;
  });

  // Rescale the chart axes.
  timelineXScale = timelineXScale
    .domain([
      new Date(minYearOfPublication - timelineXScaleBuffer, 0, 1),
      new Date(maxYearOfPublication + timelineXScaleBuffer, 0, 1)]);
  timelineYScale = timelineYScale
    .domain([0, d3.max(numBooksPerYear.values())]);
  timelineChart.select(".x-axis")
    .transition(timelineTransition).call(timelineXAxis);
  timelineChart.select(".y-axis")
    .transition(timelineTransition).call(timelineYAxis);

  // Add space exploration events to chart.
  //
  // DATA JOIN
  var event = timelineChart.selectAll(".space-event")
    .data(selectedEvents, function(d) { return d["Event"]; });
  // ENTER
  var newEvent = event.enter().append("g")
    .classed("space-event", true)
    .on("mouseover", timelineEventTip.show)
    .on("mouseout", timelineEventTip.hide);
  newEvent.append("svg:line")
      .attr("class", "timeline-vertical-line")
      .attr("x1", function(d) { return timelineXScale(d["Date"]); })
      .attr("y1", timelineYScale.range()[0]/4)
      .attr("x2", function(d) { return timelineXScale(d["Date"]); })
      .attr("y2", 0);
  newEvent
    .style("opacity", 0)
    .transition(timelineTransition)
    .style("opacity", 1);
  // UPDATE
  newEvent.merge(event).select("line")
    .transition(timelineTransition)
      .attr("x1", function(d) { return timelineXScale(d["Date"]); })
      .attr("x2", function(d) { return timelineXScale(d["Date"]); });
  // EXIT
  event.exit().remove();

  // Add bars to the chart:
  //
  // DATA JOIN
  // Join new data with old elements, if any.
  var bar = timelineChart.selectAll(".bar")
    .data(numBooksPerYear.entries(), function(d) { return d.key; });

  // UPDATE
  // Update old elements as needed.

  // ENTER
  // Create new elements as needed.
  var newBar = bar.enter().append("g")
    .attr("class", "bar")
    .on("mouseover", function(d) {
      d3.select(this).select("rect").classed("timeline-brushed-bar", true);
    })
    .on("mouseout", function(d) {
        d3.select(this).select("rect").classed("timeline-brushed-bar", false);
    })
    .on("click", function(d) {
      console.log("filter year " + d.key);
      add_filter(data, {
        "attr_name": "Year of Publication",
        "operator": (attr_val, filter_val) => {
          return attr_val == filter_val;
        },
        "filter_value": d.key,
      });
    });
  newBar
      .append("rect")
      .attr("width", timelineBarWidth - timelineBarMargin)
      .attr("fill", "#00B5C6");
  // ENTER + UPDATE
  // After merging the entered elements with the update selection,
  // apply operations to both.
  var mergedBar = bar.merge(newBar);
  mergedBar.select("rect")
    .attr("y", function(d) { return timelineYScale(d.value); })
    .attr("x", function(d) { return timelineXScale(new Date(d.key, 0, 1)); })
    .attr("height", function(d) {
      return timelineHeight - timelineYScale(d.value);
    });
  mergedBar
    .style("opacity", 0.0)
    .transition(timelineTransition)
    .style("opacity", 1.0);

  // EXIT
  // Remove old elements as needed.
  bar.exit()
    .transition(timelineTransition)
    .attr("y", timelineYScale(0))
    .attr("height", timelineHeight - timelineYScale(0))
    .style('opacity', 0.0)
    .remove();
}

///////////////
//  PLANETS  //
///////////////
var planetsWidth;
var planetsHeight;
var planetsColorScale;
var planetsTreemap;

function compute_books_per_planet(data) {
  return _compute_num_books_per_attr(data, "Planet");
}

function init_planets(data) {
  var selectedBooks = get_selected_books(data);
  var selectedBooksPerPlanet = compute_books_per_planet(selectedBooks);

  // Compute the treemap.
  var chart = d3.select("#planets");
  planetsWidth = chart.node().getBoundingClientRect().width;
  planetsHeight = chart.node().getBoundingClientRect().height;
  planetsColorScale = d3.scaleSequential(d3.interpolateRgb("#00B5C6", "#00B5C6"))
    .domain(d3.extent(selectedBooksPerPlanet.values()));

  planetsTreemap = d3.treemap()
    .tile(d3.treemapSquarify)
    .size([planetsWidth, planetsHeight])
    .round(true)
    .paddingInner(2);
}

function update_planets(data) {
  var chart = d3.select("#planets");
  var selectedBooks = get_selected_books(data);
  if (selectedBooks.length == 0) {
    chart.selectAll(".treemapTile").remove();
    return;
  }

  var selectedBooksPerPlanet = compute_books_per_planet(selectedBooks);
  //console.log(selectedBooksPerPlanet);

  // Compute the treemap.
  var root = d3.hierarchy(
      {"name": "root", "children": selectedBooksPerPlanet.entries()})
    .sum(function(d){ return d.value; });
  planetsTreemap(root);

  // Redraw the treemap.
  var planetKeyFunction = (d) => { return d.data.key + toString(d.value); };
  var planetClickHandler = (d) => {
    // Filter books by this planet
    add_filter(data, {
      "attr_name": "Planet",
      "operator": (attr, filter_val) => { return attr.includes(filter_val); },
      "filter_value": d.data.key
    });
  };
  _redraw_treemap(chart, root, planetKeyFunction, planetClickHandler);
}


///////////////
//  AUTHORS  //
///////////////
const max_displayed_authors = 15;

function compute_books_per_author(data) {
  return _compute_num_books_per_attr(data, "Authors");
}

function update_authors(data) {
  var chart = d3.select("#authors");
  var selectedBooks = get_selected_books(data);
  if (selectedBooks.length == 0) {
    chart.selectAll(".treemapTile").remove();
    return;
  }

  booksPerSelectedAuthor = compute_books_per_author(selectedBooks);
  var sortedAuthors = booksPerSelectedAuthor.entries()
    .sort(function(a, b) { return b.value - a.value; });
  var mostPopularAuthors = sortedAuthors.slice(0, max_displayed_authors);

  // Compute the treemap.
  var width = chart.node().getBoundingClientRect().width;
  var height = chart.node().getBoundingClientRect().height;
  var colorScale = d3.scaleSequential(d3.interpolateRgb("#00B5C6", "#00B5C6"))
    .domain(d3.extent(
      mostPopularAuthors.map(function(d) { return d.value; })));

  var treemap = d3.treemap()
    .tile(d3.treemapSquarify)
    .size([width, height])
    .round(true)
    .paddingInner(2);
  var root = d3.hierarchy(
      {"name": "root", "children": mostPopularAuthors})
    .sum(function(d){ return d.value; });
  treemap(root);

  // Draw the treemap.
  var authorKeyFunction = (d) => { return d.data.key; };
  var authorClickHandler = (d) => {
    // Filter books by selected author.
    add_filter(data, {
      "attr_name": "Authors",
      "operator": (attr, filter_val) => { return attr.includes(filter_val); },
      "filter_value": d.data.key
    });
  }
  _redraw_treemap(chart, root, authorKeyFunction, authorClickHandler);
}


////////////////
//  KEYWORDS  //
////////////////
const max_displayed_keywords = 15;
var keywordsWidth;
var keywordsHeight;
var keywordsColorScale;
var keywordsTreemap;

function compute_keyword_frequencies(data) {
  var keyword_frequencies = d3.map();
  var filter_words = [];
  for (var i = 0; i <= allFilters.length - 1; i++) {

    if(allFilters[i]["attr_name"] == "keywords") {

      filter_words.push(allFilters[i]["filter_value"] )
    }
  }
  data.forEach(function(d){
    d["keywords"].forEach(function(k){
      var freq = 0;
      if (filter_words.indexOf(k["keyword"])>=0) {
        //do nothing
      }
      else if (keyword_frequencies.has(k["keyword"])) {
        freq = keyword_frequencies.get(k["keyword"]);
      }
      freq += k["count"];
      keyword_frequencies.set(k["keyword"], freq);
    });
  });
  return keyword_frequencies;
}

function init_keywords(data) {
  var selectedBooks = get_selected_books(data);
  var keywordFrequencies = compute_keyword_frequencies(selectedBooks);
  var sortedKeywords = keywordFrequencies.entries()
    .sort(function(a, b) { return b.value - a.value; });
  var mostFrequentKeywords = sortedKeywords.slice(0, max_displayed_keywords);

  var chart = d3.select("#keywords");
  keywordsWidth = chart.node().getBoundingClientRect().width;
  keywordsHeight = chart.node().getBoundingClientRect().height;
  keywordsColorScale = d3.scaleSequential(d3.interpolateRgb("#DDD", "#DDD"))
    .domain(d3.extent(
      d3.map(mostFrequentKeywords, function(d) { return d.value; })));
  keywordsTreemap = d3.treemap()
    .tile(d3.treemapSquarify)
    .size([keywordsWidth, keywordsHeight])
    .round(false)
    .paddingInner(2);
}

function update_keywords(data) {
  var chart = d3.select("#keywords");
  var selectedBooks = get_selected_books(data);
  if (selectedBooks.length == 0) {
    chart.selectAll(".treemapTile").remove();
    return;
  }

  var keywordFrequencies = compute_keyword_frequencies(selectedBooks);
  var sortedKeywords = keywordFrequencies.entries()
    .sort(function(a, b) { return b.value - a.value; });
  var mostFrequentKeywords = sortedKeywords.slice(0, max_displayed_keywords);

  // Compute the treemap.
  var root = d3.hierarchy(
      {"name": "root", "children": mostFrequentKeywords})
    .sum(function(d){ return d.value; });
  keywordsTreemap(root);

  // Redraw the treemap.
  var keywordKeyFunction = (d) => { return d.data.key; };
  var keywordClickHandler = (d) => {
    // Filter books by this keyword.
    add_filter(data, {
      "attr_name": "keywords",
      "operator": (attr, filter_val) => {
        return attr.filter(function(d){
          return d["keyword"] == filter_val;
        }).length > 0;
      },
      "filter_value": d.data.key,
    });
  };

  // Redraw treemap.
  _redraw_treemap(chart, root, keywordKeyFunction, keywordClickHandler);
}


/////////////////
//  SENTIMENT  //
/////////////////
const sentimentMargin = {top: 5, right: 15, bottom: 18, left: 15};
const sentimentValueFormat = d3.format(".3f");
const posThreshold = 0.15;
const veryPosThreshold = 0.45;
const subjThreshold = 0.2;
const verySubjThreshold = 0.3;
var sentimentChart;
var sentimentWidth;
var sentimentHeight;
var sentimentXScale;
var sentimentYScale;
var sentimentBrushArea;
var sentimentBrush;

// Called when the brush moves.
function sentimentBrushMove() {
  // Highlight the selected circles.
  var e = d3.brushSelection(this);
  sentimentChart.selectAll(".dot")
    .classed("sentiment-brushed-dot", function(d) {
      var x = d3.select(this).attr("cx");
      var y = d3.select(this).attr("cy");
      return !(e[0][0] > x || x > e[1][0] || e[0][1] > y || y > e[1][1]);
    });
}

// Called when the brush ends.
function sentimentBrushEnd() {
  var brushedDot = sentimentChart.selectAll(".sentiment-brushed-dot");
  if (!d3.event.selection || brushedDot.size() == 0) {
    brushedDot.classed("sentiment-brushed-dot", false);
    return;
  }

  // Add filter based on the brush selection.
  var e = d3.brushSelection(this);
  e = [
    [sentimentXScale.invert(e[0][0]), sentimentYScale.invert(e[0][1])],
    [sentimentXScale.invert(e[1][0]), sentimentYScale.invert(e[1][1])],
  ];

  remove_filter_by_attr_name(
      allBookData, "sentiment",
      true, /* do not remove lasso */
      false /* will update vis after adding the new filter below */);

  add_filter(allBookData, {
    "attr_name": "sentiment",
    "operator": (attr_val, filter_val) => {
      var x = attr_val[0];
      var y = attr_val[1];
      return !(filter_val[0][0] > x || x > filter_val[1][0]
          || filter_val[1][1] > y || y > filter_val[0][1]);
    },
    "filter_value": e,
    "on_remove_callback": () => {  // called when this filter is removed
      // Clear the brush
      sentimentBrushArea.node().__brush.selection = null;
      sentimentBrushArea.call(sentimentBrush);
      sentimentChart.selectAll(".dot").classed("sentiment-brushed-dot", false);
    },
  });
}

function init_sentiment(data) {
  var selectedBooks = get_selected_books(data);

  // Create the chart.
  var svg = d3.select("#sentiment");
  sentimentChart = svg.append("g")
    .attr("transform",
        "translate(" + sentimentMargin.left + "," + sentimentMargin.top + ")");
  sentimentWidth =
      svg.node().getBoundingClientRect().width
        - sentimentMargin.left - sentimentMargin.right;
  sentimentHeight =
      svg.node().getBoundingClientRect().height
        - sentimentMargin.top - sentimentMargin.bottom;

  // Create the chart axes.
 sentimentXScale = d3.scaleLinear()
      .domain([-0.7, 0.7])
      .range([0, sentimentWidth]);
  sentimentYScale = d3.scaleLinear()
      .domain([0, 1])
      .range([sentimentHeight, 0]);
  var xAxis = d3.axisBottom(sentimentXScale).tickValues([]);
  var yAxis = d3.axisLeft(sentimentYScale).tickValues([]);
  sentimentChart.append("g")
      .attr("class", "x-axis chart-axis")
      .attr("transform", "translate(0," + sentimentHeight + ")");
  sentimentChart.append("g")
      .attr("class", "y-axis chart-axis");
  sentimentChart.select(".x-axis").call(xAxis);
  sentimentChart.select(".y-axis").call(yAxis);
  sentimentChart.append("text")
    .classed("axis-label", true)
    .attr("transform", "translate("
        + 42 + " ,"
        + (sentimentHeight + sentimentMargin.top + 8) + ")")
    .style("text-anchor", "left")
    .text("negative")
    .style("font-size", "10px");
  sentimentChart.append("text")
    .classed("axis-label", true)
    .attr("transform", "translate("
        + (sentimentWidth -4) + " ,"
        + (sentimentHeight + sentimentMargin.top + 8) + ")")
    .style("text-anchor", "right")
    .text("positive")
    .style("font-size", "10px");
  // text label for the y axis
  sentimentChart.append("text")
      .classed("axis-label", true)
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - sentimentMargin.left)
      .attr("x", 0 - (sentimentHeight / 2) - 30)
      .attr("dy", "1em")
      .style("text-anchor", "left")
      .text("obj")
      .style("font-size", "10px");
  sentimentChart.append("text")
      .classed("axis-label", true)
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - sentimentMargin.right)
      .attr("x", -4)
      .attr("dy", "1em")
      .style("text-anchor", "right")
      .text("subj")
      .style("font-size", "10px");
  sentimentBrush = d3.brush()
    .extent([[0, 0], [sentimentWidth, sentimentHeight]])
    .on("brush", sentimentBrushMove)
    .on("end", sentimentBrushEnd);
  sentimentBrushArea = sentimentChart.append("g")
    .attr("class", "brush")
    .call(sentimentBrush);
}

function update_sentiment(data) {
  var selectedBooks = get_selected_books(data);
  if (selectedBooks.length == 0) {
    sentimentChart.selectAll(".dot").remove();
    return;
  }

  var color = d3.scaleLinear()
      .domain([-1,1])
      .range(["red", "#00B5C6"])

  var dot = sentimentChart.selectAll(".dot")
      .data(data, function(d) {
        var k = d["Goodreads Id"];
        // console.log(k);
        return k;
      });
  // ENTER new
  var newDot = dot.enter().append("circle")
      .classed("dot", true);
  newDot.attr("r", 3.5)
      .attr("cx", function(d) {
        return sentimentXScale(d["polarity"]);
      })
      .attr("cy", function(d) {
        return sentimentYScale(d["subjectivity"]);
      })
      .attr('fill',function(d,i) { return color(d["polarity"]); })
  newDot.on("mouseover", function(d) {
        d3.select(this).style("stroke", "orangered");
      })
      .on("mouseout", function(d) {
        d3.select(this)
          .attr('fill',function(d,i) { return color(d["polarity"]); })
          .style("stroke", "");
      });
  // Fade in new dots.
  newDot.merge(dot)
    .transition()
      .duration(300)
    .style("opacity", function(d) {
      return d["selected"] ? 1.0 : 0.05;
    });
}


/* Helper functions */

function _compute_num_books_per_attr(data, attr_name) {
  // Get all attr values in the given dataset.
  allAttrVals = data.map(function(d){ return d[attr_name]; });
  // Parse comma-separated attr values.
  allAttrVals = allAttrVals.map(function(d){
    return d.split(",").map(function(s){ return s.trim(); });
  });
  allAttrVals = [].concat.apply([], allAttrVals);  // flatten

  // Count books per attr value.
  var numBooksPerAttrVal = d3.map();
  var attr_filters = [];
  for (var i = 0; i <= allFilters.length - 1; i++) {
    if(allFilters[i]["attr_name"] == attr_name) {
      attr_filters.push(allFilters[i]["filter_value"] )
    }
  }

  allAttrVals.forEach(function(p) {
    var numBooks = 0;
    if(attr_filters.indexOf(p) >= 0) {

      //do nothing
    }
    else if (numBooksPerAttrVal.has(p)) {
      numBooks = numBooksPerAttrVal.get(p);
      numBooksPerAttrVal.set(p, numBooks + 1);
    } else {
      numBooksPerAttrVal.set(p, numBooks + 1);
    }
  });
  return numBooksPerAttrVal;
}

const treemapAnimation = d3.transition()
  .duration(300);

function fontSize(d,i) {
var size = d.dx/5;
var words = d.data.key.split(' ');
var word = words[0];
var width = d.dx;
var height = d.dy;
var length = 0;
d3.select(this).style("font-size", size + "px").text(word);
while(((this.getBBox().width >= width) || (this.getBBox().height >= height)) && (size > 12))
 {
  size--;
  d3.select(this).style("font-size", size + "px");
  this.firstChild.data = word;
 }
}

function wordWrap(d, i){
var words = d.data.key.split(' ');
var line = new Array();
var length = 0;
var text = "";
var width = d.dx;
var height = d.dy;
var word;
do {
   word = words.shift();
   line.push(word);
   if (words.length)
     this.firstChild.data = line.join(' ') + " " + words[0]; 
   else
     this.firstChild.data = line.join(' ');
   length = this.getBBox().width;
   if (length < width && words.length) {
     ;
   }
   else {
     text = line.join(' ');
     this.firstChild.data = text;
     if (this.getBBox().width > width) { 
       text = d3.select(this).select(function() {return this.lastChild;}).text();
       text = text + "...";
       d3.select(this).select(function() {return this.lastChild;}).text(text);
       d3.select(this).classed("wordwrapped", true);
       break;
    }
    else
      ;

  if (text != '') {
    d3.select(this).append("svg:tspan")
    .attr("x", 0)
    .attr("dx", "0.15em")
    .attr("dy", "0.9em")
    .text(text);
  }
  else
     ;

  if(this.getBBox().height > height && words.length) {
     text = d3.select(this).select(function() {return this.lastChild;}).text();
     text = text + "...";
     d3.select(this).select(function() {return this.lastChild;}).text(text);
     d3.select(this).classed("wordwrapped", true);

     break;
  }
  else
     ;

  line = new Array();
    }
  } while (words.length);
  this.firstChild.data = '';
} 

function _redraw_treemap(chart, root, keyFunction, clickHandler) {
  // Handle empty tree.
  if (!("children" in root)) {
    chart.selectAll(".treemapTile").remove();
    return;
  }

  // DATA JOIN
  // Join new data with old elements, if any.
  var cell = chart.selectAll("g")
    .data(root.leaves(), keyFunction);

  // ENTER new
  var newCell = cell.enter().append("g")
    .classed("treemapTile", true)
    .on("mouseover", function(d) {
      d3.select(this).select("rect")
        .attr("stroke", "orangered")
        .attr("fill", "rgba(0,12,19,0.8)");
    })
    .on("mouseout", function(d) {
      d3.select(this).select("rect")
        .attr("stroke", "#00B5C6")
        .attr("fill", "rgba(0,12,19,0.5)");
    })
    .on("click", clickHandler);
  newCell.append("rect");
  newCell.append("text")
    .selectAll("tspan")
      .data(function(d) { return d.data.key.split(" "); })
    .enter().append("tspan")
      .style("opacity", 0.0)
      .transition(treemapAnimation)
      .style("opacity", 1.0)
      .attr("fill", "#fff")
      .attr("x",0)
      .attr("font-size", "9px")
      .attr("x", 4)
      .attr("y", function(d, i) { return 10 + i * 10; })
      .text(function(d) { return d; });
  newCell.append("title");

  // UPDATE merged
  var mergedCells = cell.merge(newCell);
  mergedCells.select("title")
    .text(function(d) { return d.data.key + "\n" + d.value; });
  mergedCells.transition(treemapAnimation)
    .attr("transform", function(d) {
      return "translate(" + d.x0 + "," + d.y0 + ")";
    });
  mergedCells.select("rect")
      .transition(treemapAnimation)
      .attr("id", function(d) { return d.data.id; })
      .attr("width", function(d) { return d.x1 - d.x0; })
      .attr("height", function(d) { return d.y1 - d.y0; })
      .attr("stroke-width", 1)
      .attr("stroke", "#00B5C6")
      .attr("fill", "rgba(0,12,19,0.5)");

  // EXIT
  cell.exit().remove();
}