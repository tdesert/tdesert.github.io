# Algolia Instant Search

Example project using Algolia Search API client. <br />
The idea was to start from the existing [Algolia Instant Search](https://github.com/algolia/instant-search-demo/) example project, with the following updates in mind:

* Complete UI refactor
* Make it responsive
* Make the header fixed on top on the page
* Setup a progressive pagination (load more products instead of using page numbers)
* Add a summary of all applied facets in the header with the ability to remove them on click
* Add the ability to clear a whole facet at a time (clear all categories filters at once for example)
* Add the ability to filter / sort results by user ratings

## Setup
* `git clone git@github.com:tdesert/tdesert.github.io.git`
* `npm install`
* `bower install`
* `gulp serve`

## Build
* `gulp`
* Open `dist/index.html` in your browser

## Documentation used for this project

* <http://designexcellent.com/ux-search-design-organising-filtering/>
* <http://baymard.com/blog/macys-filtering-experience>
* <http://baymard.com/blog/how-to-design-applied-filters>

